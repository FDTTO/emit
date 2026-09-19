package dev.emit.shared.ratelimit;

/**
 * What the limiter decided for one request, and what a client needs to pace
 * itself by: the window's limit, the requests left in it after this one, and
 * the seconds until the oldest request in the window leaves it and frees a
 * slot, which a refusal sends as {@code Retry-After}.
 */
public record RateLimitDecision(boolean allowed, int limit, int remaining, long resetSeconds) {
}
