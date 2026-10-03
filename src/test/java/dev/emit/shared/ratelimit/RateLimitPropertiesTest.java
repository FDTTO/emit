package dev.emit.shared.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class RateLimitPropertiesTest {

    @EnableConfigurationProperties(RateLimitProperties.class)
    static class Binding {}

    private final ApplicationContextRunner context =
            new ApplicationContextRunner().withUserConfiguration(Binding.class);

    @Test
    void theConfiguredLimitIsTheOneUsed() {
        context.withPropertyValues("emit.rate-limit.requests-per-minute=5")
                .run(bound -> assertThat(
                                bound.getBean(RateLimitProperties.class).requestsPerMinute())
                        .isEqualTo(5));
    }

    @Test
    void withoutConfigurationTheLimitIsTwentyAMinute() {
        context.run(bound -> assertThat(bound.getBean(RateLimitProperties.class).requestsPerMinute())
                .isEqualTo(20));
    }
}
