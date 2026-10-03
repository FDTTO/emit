package dev.emit.shared.ratelimit;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties("emit.rate-limit")
@Getter
@Setter
public class RateLimitProperties {

    private int requestsPerMinute = 20;
}
