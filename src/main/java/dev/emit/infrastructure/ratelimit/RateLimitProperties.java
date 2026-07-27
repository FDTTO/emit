package dev.emit.infrastructure.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Getter;
import lombok.Setter;

@Component
@ConfigurationProperties("emit.rate-limit")
@Getter
@Setter
public class RateLimitProperties {

    private int requestsPerMinute = 20;
}
