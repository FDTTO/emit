package dev.emit.infrastructure.multitenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import dev.emit.domain.tenant.Tenant;
import dev.emit.domain.tenant.TenantRepository;
import jakarta.servlet.Filter;

@ExtendWith(MockitoExtension.class)
class TenantFilterTest {

    @Mock
    private TenantRepository tenantRepository;

    @InjectMocks
    private TenantFilter tenantFilter;

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        MDC.clear();
        TenantContext.clear();
    }

    private Tenant buildTenant(String schemaName) {
        Tenant tenant = new Tenant();
        tenant.setSchemaName(schemaName);
        tenant.setName("Test Corp");
        tenant.setActive(true);
        return tenant;
    }

    @Test
    void shouldSetTenantContextAndSecurityContextWhenApiKeyIsValid() throws Exception {
        String apiKey = "valid-api-key";
        String hash = ApiKeyHasher.hash(apiKey);
        Tenant tenant = buildTenant("tenant_abc");

        when(tenantRepository.findByApiKeyHash(hash)).thenReturn(Optional.of(tenant));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-API-Key", apiKey);

        var capturedTenant = new String[1];
        var capturedSchema = new String[1];
        var capturedPrincipal = new String[1];
        Filter capturingFilter = (req, res, fc) -> {
            capturedTenant[0] = TenantContext.getTenant();
            capturedSchema[0] = MDC.get("tenantSchema");
            var auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null)
                capturedPrincipal[0] = auth.getName();
        };
        tenantFilter.doFilterInternal(request, new MockHttpServletResponse(),
                new MockFilterChain(mock(jakarta.servlet.Servlet.class), capturingFilter));

        assertThat(capturedTenant[0]).isEqualTo("tenant_abc");
        assertThat(capturedSchema[0]).isEqualTo("tenant_abc");
        assertThat(capturedPrincipal[0]).isEqualTo("tenant_abc");

        // finally block clears TenantContext and MDC (SecurityContextHolder is cleared
        // by Spring Security framework)
        assertThat(TenantContext.getTenant()).isNull();
        assertThat(MDC.get("tenantSchema")).isNull();
    }

    @Test
    void shouldNotSetTenantContextWhenApiKeyIsAbsent() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();

        tenantFilter.doFilterInternal(request, new MockHttpServletResponse(), new MockFilterChain());

        verify(tenantRepository, never()).findByApiKeyHash(org.mockito.ArgumentMatchers.any());
        assertThat(TenantContext.getTenant()).isNull();
    }

    @Test
    void shouldNotSetTenantContextWhenApiKeyIsInvalid() throws Exception {
        String apiKey = "invalid-key";
        String hash = ApiKeyHasher.hash(apiKey);

        when(tenantRepository.findByApiKeyHash(hash)).thenReturn(Optional.empty());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-API-Key", apiKey);

        tenantFilter.doFilterInternal(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(TenantContext.getTenant()).isNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void shouldAlwaysSetRequestIdInMdc() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();

        // capture MDC inside the filter chain execution
        var capturedRequestId = new String[1];
        Filter capturingFilter = (req, res, fc) -> capturedRequestId[0] = MDC.get("requestId");
        MockFilterChain chain = new MockFilterChain(mock(jakarta.servlet.Servlet.class), capturingFilter);

        tenantFilter.doFilterInternal(request, new MockHttpServletResponse(), chain);

        assertThat(capturedRequestId[0]).isNotNull().isNotBlank();
    }

    @Test
    void shouldClearMdcAndTenantContextInFinallyEvenOnException() throws Exception {
        String apiKey = "valid-api-key";
        String hash = ApiKeyHasher.hash(apiKey);
        Tenant tenant = buildTenant("tenant_abc");

        when(tenantRepository.findByApiKeyHash(hash)).thenReturn(Optional.of(tenant));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-API-Key", apiKey);

        Filter throwingFilter = (req, res, fc) -> {
            throw new RuntimeException("downstream failure");
        };
        MockFilterChain throwingChain = new MockFilterChain(mock(jakarta.servlet.Servlet.class), throwingFilter);

        try {
            tenantFilter.doFilterInternal(request, new MockHttpServletResponse(), throwingChain);
        } catch (RuntimeException ignored) {
        }

        assertThat(TenantContext.getTenant()).isNull();
        assertThat(MDC.get("tenantSchema")).isNull();
        assertThat(MDC.get("requestId")).isNull();
    }
}
