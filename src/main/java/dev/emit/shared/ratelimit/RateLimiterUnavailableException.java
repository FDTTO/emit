package dev.emit.shared.ratelimit;

/** Redis could not be asked, so whether a tenant is within its budget is unknown. */
public class RateLimiterUnavailableException extends RuntimeException {

    public RateLimiterUnavailableException(Throwable cause) {
        super("The rate limiter could not be reached", cause);
    }
}
