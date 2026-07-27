package dev.emit.infrastructure.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RateLimiterServiceTest {

    private RateLimiterService service;

    @BeforeEach
    void setUp() {
        RateLimitProperties properties = new RateLimitProperties();
        properties.setRequestsPerMinute(3);
        service = new RateLimiterService(properties);
    }

    @Test
    void shouldAllowRequestsWithinLimit() {
        assertThat(service.tryConsume("tenant_a")).isTrue();
        assertThat(service.tryConsume("tenant_a")).isTrue();
        assertThat(service.tryConsume("tenant_a")).isTrue();
    }

    @Test
    void shouldBlockRequestAfterLimitExhausted() {
        service.tryConsume("tenant_a");
        service.tryConsume("tenant_a");
        service.tryConsume("tenant_a");

        assertThat(service.tryConsume("tenant_a")).isFalse();
    }

    @Test
    void shouldIsolateBucketsPerTenant() {
        service.tryConsume("tenant_a");
        service.tryConsume("tenant_a");
        service.tryConsume("tenant_a");

        // tenant_a exhausted - tenant_b must be unaffected
        assertThat(service.tryConsume("tenant_b")).isTrue();
    }
}
