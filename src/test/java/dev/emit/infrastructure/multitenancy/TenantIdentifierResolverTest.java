package dev.emit.infrastructure.multitenancy;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class TenantIdentifierResolverTest {

    private final TenantIdentifierResolver resolver = new TenantIdentifierResolver();

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldReturnTenantFromContextWhenSet() {
        TenantContext.setTenant("tenant_acme");

        assertThat(resolver.resolveCurrentTenantIdentifier()).isEqualTo("tenant_acme");
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
