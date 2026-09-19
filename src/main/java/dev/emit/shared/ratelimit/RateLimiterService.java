package dev.emit.shared.ratelimit;

import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
     */
    private static final RedisScript<Long> SLIDING_WINDOW_SCRIPT = RedisScript.of("""
            local key      = KEYS[1]
            local now      = tonumber(ARGV[1])
            local window   = tonumber(ARGV[2])
            local limit    = tonumber(ARGV[3])
            local jti      = ARGV[4]
            redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
            local count = redis.call('ZCARD', key)
            if count < limit then
                redis.call('ZADD', key, now, jti)
                redis.call('PEXPIRE', key, window)
                return 1
            end
            return 0
            """, Long.class);

    public boolean tryConsume(String tenantSchema) {
        long now = System.currentTimeMillis();
        Long result = redisTemplate.execute(
                SLIDING_WINDOW_SCRIPT,
                List.of("rl:" + tenantSchema),
                String.valueOf(now),
                String.valueOf(WINDOW_MILLIS),
                String.valueOf(properties.getRequestsPerMinute()),
                UUID.randomUUID().toString());

        // Fails closed: without Redis there is no way to know the
        // tenant is within its budget.
        if (result == null) {
            log.error("Redis rate-limit script returned null - blocking request for tenant={}", tenantSchema);
            return false;
        }
        return result == 1L;
    }
}
