package dev.emit.shared.web;

/**
 * What the API says when it refuses a request before any controller runs.
 * The filters write these and the published spec quotes them, so the two
 * read from one place.
 */
public final class RefusalMessages {

    public static final String AUTHENTICATION_REQUIRED = "Authentication required.";
    public static final String INVALID_TOKEN = "Invalid or expired token.";
    public static final String INVALID_API_KEY = "Invalid API key.";
    public static final String TENANT_INACTIVE = "Tenant is inactive.";
    public static final String WRONG_CREDENTIAL = "This credential cannot access this route. "
            + "Tenant management needs an admin token; documents need a tenant API key.";

    private RefusalMessages() {
    }

    public static String rateLimited(long resetSeconds) {
        return "Rate limit exceeded. Try again in " + resetSeconds + (resetSeconds == 1 ? " second." : " seconds.");
    }
}
