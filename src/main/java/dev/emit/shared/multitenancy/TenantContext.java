package dev.emit.shared.multitenancy;

/**
 * The tenant whose schema the current thread works in. A tenant is only ever
 * set by opening a scope, and closing it restores the tenant that was current
 * before, so a pooled thread cannot carry one request's tenant into the next:
 *
 * <pre>{@code
 * try (var _ = TenantContext.open(schemaName)) {
 *     // work in schemaName
 * }
 * }</pre>
 */
public final class TenantContext {

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    private TenantContext() {
    }

    public static Scope open(String schemaName) {
        Scope scope = new Scope(CURRENT_TENANT.get());
        CURRENT_TENANT.set(schemaName);
        return scope;
    }

    public static String getTenant() {
        return CURRENT_TENANT.get();
    }

    public static final class Scope implements AutoCloseable {

        private final String previous;

        private Scope(String previous) {
            this.previous = previous;
        }

        @Override
        public void close() {
            if (previous == null) {
                CURRENT_TENANT.remove();
            } else {
                CURRENT_TENANT.set(previous);
            }
        }
    }
}
