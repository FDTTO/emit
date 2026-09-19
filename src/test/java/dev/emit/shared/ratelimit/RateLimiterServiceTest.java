package dev.emit.shared.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
class RateLimiterServiceTest {

    @SuppressWarnings("resource")
    @Container
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    private static StringRedisTemplate redisTemplate;
    private static LettuceConnectionFactory connectionFactory;

    private RateLimiterService service;

    @BeforeAll
    static void startRedis() {
        connectionFactory = new LettuceConnectionFactory(redis.getHost(), redis.getMappedPort(6379));
        connectionFactory.afterPropertiesSet();
        redisTemplate = new StringRedisTemplate(connectionFactory);
        redisTemplate.afterPropertiesSet();
    }

    @AfterAll
    static void stopRedis() {
        connectionFactory.destroy();
    }

    @BeforeEach
    void setUp() {
        redisTemplate.getRequiredConnectionFactory().getConnection().serverCommands().flushDb();

        RateLimitProperties properties = new RateLimitProperties();
        properties.setRequestsPerMinute(3);
        service = new RateLimiterService(redisTemplate, properties);
    }

    @Test
    void shouldAllowRequestsWithinLimit() {
        assertThat(service.tryConsume("tenant_a").allowed()).isTrue();
        assertThat(service.tryConsume("tenant_a").allowed()).isTrue();
        assertThat(service.tryConsume("tenant_a").allowed()).isTrue();
    }

    @Test
    void shouldCountRemainingDownToZero() {
        assertThat(service.tryConsume("tenant_a").remaining()).isEqualTo(2);
        assertThat(service.tryConsume("tenant_a").remaining()).isEqualTo(1);
        assertThat(service.tryConsume("tenant_a").remaining()).isZero();
    }

    /*
     * The three allowed requests were made just now, so the oldest of them
     * leaves the one-minute window, and frees a slot, close to a full minute
     * from now: that is what the client is told to wait.
     */
    @Test
    void shouldBlockRequestAfterLimitExhaustedAndSayWhenASlotFrees() {
        service.tryConsume("tenant_a");
        service.tryConsume("tenant_a");
        service.tryConsume("tenant_a");

        RateLimitDecision blocked = service.tryConsume("tenant_a");

        assertThat(blocked.allowed()).isFalse();
        assertThat(blocked.limit()).isEqualTo(3);
        assertThat(blocked.remaining()).isZero();
        assertThat(blocked.resetSeconds()).isBetween(55L, 60L);
    }

    @Test
    void shouldIsolateBucketsPerTenant() {
        service.tryConsume("tenant_a");
        service.tryConsume("tenant_a");
        service.tryConsume("tenant_a");

        assertThat(service.tryConsume("tenant_b").allowed()).isTrue();
    }
}
