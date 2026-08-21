package dev.emit.application.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import dev.emit.domain.tenant.Tenant;
import dev.emit.domain.tenant.TenantNotFoundException;
import dev.emit.domain.tenant.TenantRepository;
import dev.emit.infrastructure.multitenancy.TenantProvisioner;

@ExtendWith(MockitoExtension.class)
class TenantServiceTest {

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private TenantProvisioner tenantProvisioner;

    @InjectMocks
    private TenantService tenantService;

    private Tenant buildTenant(UUID id) {
        Tenant tenant = new Tenant();
        tenant.setId(id);
        tenant.setName("Test Corp");
        tenant.setSchemaName("test_corp");
        tenant.setActive(true);
        return tenant;
    }

    @Test
    void deactivateShouldSetActiveToFalseAndSave() {
        UUID id = UUID.randomUUID();
        Tenant tenant = buildTenant(id);
        when(tenantRepository.findById(id)).thenReturn(Optional.of(tenant));

        tenantService.deactivate(id);

        assertThat(tenant.isActive()).isFalse();
        verify(tenantRepository).save(tenant);
    }

    @Test
    void reactivateShouldSetActiveToTrueAndSave() {
        UUID id = UUID.randomUUID();
        Tenant tenant = buildTenant(id);
        tenant.setActive(false);
        when(tenantRepository.findById(id)).thenReturn(Optional.of(tenant));

        tenantService.reactivate(id);

        assertThat(tenant.isActive()).isTrue();
        verify(tenantRepository).save(tenant);
    }

    @Test
    void deactivateShouldThrowWhenTenantNotFound() {
        UUID id = UUID.randomUUID();
        when(tenantRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tenantService.deactivate(id))
                .isInstanceOf(TenantNotFoundException.class);
    }

    @Test
    void reactivateShouldThrowWhenTenantNotFound() {
        UUID id = UUID.randomUUID();
        when(tenantRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tenantService.reactivate(id))
                .isInstanceOf(TenantNotFoundException.class);
    }
}
