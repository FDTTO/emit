package dev.emit.shared.multitenancy;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TenantIdentifierResolverTest {

    private final TenantIdentifierResolver resolver = new TenantIdentifierResolver();

    @Test
    void shouldReturnTenantFromContextWhenSet() {
        try (var _ = TenantContext.open("tenant_acme")) {
            assertThat(resolver.resolveCurrentTenantIdentifier()).isEqualTo("tenant_acme");
        }
    }

    @Test
    void shouldFallbackToPublicWhenContextIsEmpty() {
        assertThat(resolver.resolveCurrentTenantIdentifier()).isEqualTo("public");
    }

    @Test
    void validateExistingCurrentSessionsShouldReturnFalse() {
        assertThat(resolver.validateExistingCurrentSessions()).isFalse();
    }
}
