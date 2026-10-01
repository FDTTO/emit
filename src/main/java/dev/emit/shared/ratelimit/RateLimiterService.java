package dev.emit.shared.ratelimit;

import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RateLimiterService {

    private static final Logger log = LoggerFactory.getLogger(RateLimiterService.class);

    private final StringRedisTemplate redisTemplate;
    private final RateLimitProperties properties;

    private static final long WINDOW_MILLIS = 60_000L;

    /*
     * Sliding window implemented as a Redis sorted set.
     * Score = request timestamp in milliseconds; member = unique request ID.
     * ZREMRANGEBYSCORE removes entries outside the window before each check so
     * ZCARD always reflects only requests within the current rolling minute.
     * PEXPIRE on the key means idle tenant keys expire automatically after one
     * full window, keeping Redis memory clean without a separate cleanup job.
     * The script runs atomically (Redis is single-threaded for Lua) so there is
     * no race between the count check and the ZADD across concurrent requests.
     *
     * The time is Redis's own (TIME), never the calling instance's: every
     * instance scores on one clock, so a fleet whose clocks drift apart still
     * shares one window.
     *
     * It returns {allowed, count in window, oldest score, now}: the client is
     * told what was read inside the same atomic step as the decision, so the
     * numbers can never disagree with it.
     */
    @SuppressWarnings("rawtypes")
    private static final RedisScript<List> SLIDING_WINDOW_SCRIPT = RedisScript.of("""
            local key      = KEYS[1]
            local window   = tonumber(ARGV[1])
            local limit    = tonumber(ARGV[2])
            local jti      = ARGV[3]
            local time     = redis.call('TIME')
            local now      = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
            redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
            local count = redis.call('ZCARD', key)
            local allowed = 0
            if count < limit then
                redis.call('ZADD', key, now, jti)
                redis.call('PEXPIRE', key, window)
                count = count + 1
                allowed = 1
            end
            local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
            local oldestScore = now
            if oldest[2] then oldestScore = tonumber(oldest[2]) end
            return {allowed, count, oldestScore, now}
            """, List.class);

    /**
     * @throws RateLimiterUnavailableException when Redis cannot be asked: without it
     *         there is no knowing whether the tenant is within its budget
     */
    public RateLimitDecision tryConsume(String tenantSchema) {
        int limit = properties.getRequestsPerMinute();
        List<?> result;
        try {
            result = redisTemplate.execute(
                    SLIDING_WINDOW_SCRIPT,
                    List.of("rl:" + tenantSchema),
                    String.valueOf(WINDOW_MILLIS),
                    String.valueOf(limit),
                    UUID.randomUUID().toString());
        } catch (DataAccessException failure) {
            log.error("Rate limiter unavailable for tenant={}", tenantSchema, failure);
            throw new RateLimiterUnavailableException(failure);
        }
        if (result == null || result.size() < 4) {
            log.error("Redis rate-limit script returned {} for tenant={}", result, tenantSchema);
            throw new RateLimiterUnavailableException(new IllegalStateException("Unexpected script result: " + result));
        }

        boolean allowed = ((Number) result.get(0)).longValue() == 1L;
        long count = ((Number) result.get(1)).longValue();
        long oldest = ((Number) result.get(2)).longValue();
        long now = ((Number) result.get(3)).longValue();
        long untilOldestLeaves = Math.max(0L, oldest + WINDOW_MILLIS - now);
        long resetSeconds = Math.max(1L, (untilOldestLeaves + 999) / 1000);
        return new RateLimitDecision(allowed, limit, (int) Math.max(0L, limit - count), resetSeconds);
    }
}
