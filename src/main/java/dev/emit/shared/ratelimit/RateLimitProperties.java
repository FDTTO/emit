package dev.emit.shared.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties("emit.rate-limit")
public record RateLimitProperties(@DefaultValue("20") int requestsPerMinute) {}
