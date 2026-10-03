package dev.emit.shared.multitenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class TenantContextTest {

    @Test
    void closingTheScopeLeavesTheThreadWithNoTenant() {
        try (var _ = TenantContext.open("tenant_acme")) {
            assertThat(TenantContext.getTenant()).isEqualTo("tenant_acme");
        }

        assertThat(TenantContext.getTenant()).isNull();
    }

    @Test
    void anInnerScopeHandsTheOuterTenantBackWhenItCloses() {
        try (var _ = TenantContext.open("tenant_outer")) {
            try (var _ = TenantContext.open("tenant_inner")) {
                assertThat(TenantContext.getTenant()).isEqualTo("tenant_inner");
            }
            assertThat(TenantContext.getTenant()).isEqualTo("tenant_outer");
        }

        assertThat(TenantContext.getTenant()).isNull();
    }

    @Test
    void workThatFailsStillLeavesNoTenant() {
        assertThatThrownBy(() -> {
            try (var _ = TenantContext.open("tenant_acme")) {
                throw new IllegalStateException("work failed");
            }
        }).hasMessage("work failed");

        assertThat(TenantContext.getTenant()).isNull();
    }
}
