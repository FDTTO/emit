package dev.emit.tenant.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import dev.emit.tenant.domain.Tenant;
import dev.emit.tenant.domain.TenantNotFoundException;
import dev.emit.tenant.domain.TenantRepository;

@ExtendWith(MockitoExtension.class)
class TenantServiceTest {

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private SchemaProvisioner schemaProvisioner;

    @InjectMocks
    private TenantService tenantService;

    private Tenant buildTenant() {
        return Tenant.create("Test Corp", "test_corp", "hashvalue");
    }

    @Test
    void createShouldSaveTenantAndProvisionSchema() {
        Tenant saved = buildTenant();
        when(tenantRepository.save(any())).thenReturn(saved);
        doNothing().when(schemaProvisioner).provision(anyString());

        TenantService.TenantCreated result = tenantService.create("Test Corp", "test_corp");

        assertThat(result.tenant()).isEqualTo(saved);
        assertThat(result.apiKey()).isNotBlank();
        assertThat(result.apiKey()).hasSize(64);
        verify(tenantRepository).save(any());
        verify(schemaProvisioner).provision("test_corp");
    }

    @Test
    void deactivateShouldSetActiveToFalseAndSave() {
        UUID id = UUID.randomUUID();
        Tenant tenant = buildTenant();
        when(tenantRepository.findById(id)).thenReturn(Optional.of(tenant));

        tenantService.deactivate(id);

        assertThat(tenant.isActive()).isFalse();
        verify(tenantRepository).save(tenant);
    }

    @Test
    void reactivateShouldSetActiveToTrueAndSave() {
        UUID id = UUID.randomUUID();
        Tenant tenant = buildTenant();
        tenant.deactivate();
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

    @Test
    void deactivateShouldBeIdempotentWhenAlreadyInactive() {
        UUID id = UUID.randomUUID();
        Tenant tenant = buildTenant();
        tenant.deactivate();
        when(tenantRepository.findById(id)).thenReturn(Optional.of(tenant));

        tenantService.deactivate(id);

        assertThat(tenant.isActive()).isFalse();
        verify(tenantRepository).save(tenant);
    }

    @Test
    void listAllShouldDelegateToRepository() {
        when(tenantRepository.findAll()).thenReturn(List.of(buildTenant()));

        List<Tenant> result = tenantService.listAll();

        assertThat(result).hasSize(1);
        verify(tenantRepository).findAll();
    }

    @Test
    void findByIdShouldThrowWhenNotFound() {
        UUID id = UUID.randomUUID();
        when(tenantRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tenantService.findById(id))
                .isInstanceOf(TenantNotFoundException.class);
    }

    @Test
    void reactivateShouldBeIdempotentWhenAlreadyActive() {
        UUID id = UUID.randomUUID();
        Tenant tenant = buildTenant();
        when(tenantRepository.findById(id)).thenReturn(Optional.of(tenant));

        tenantService.reactivate(id);

        assertThat(tenant.isActive()).isTrue();
        verify(tenantRepository).save(tenant);
    }
}
