package dev.emit.infrastructure.ratelimit;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RateLimiterService {

    private final RateLimitProperties properties;

    // One bucket per tenant, created lazily on first request.
    // ConcurrentHashMap.computeIfAbsent is atomic per key - safe under concurrent
    // load.
    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    public boolean tryConsume(String tenantSchema) {
        return buckets.computeIfAbsent(tenantSchema, k -> newBucket()).tryConsume(1);
    }

    private Bucket newBucket() {
        int limit = properties.getRequestsPerMinute();
        Bandwidth bandwidth = Bandwidth.builder()
                .capacity(limit)
                .refillGreedy(limit, Duration.ofMinutes(1))
                .build();
        return Bucket.builder().addLimit(bandwidth).build();
    }
}
