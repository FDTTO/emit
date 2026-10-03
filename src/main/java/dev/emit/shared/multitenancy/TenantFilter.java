package dev.emit.shared.multitenancy;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import dev.emit.shared.web.ApiErrorWriter;
import dev.emit.shared.web.RefusalMessages;
import dev.emit.tenant.domain.Tenant;
import dev.emit.tenant.domain.TenantRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class TenantFilter extends OncePerRequestFilter {

    private final TenantRepository tenantRepository;
    private final ApiErrorWriter errorWriter;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String apiKey = request.getHeader("X-API-Key");
        if (apiKey == null) {
            filterChain.doFilter(request, response);
            return;
        }

        Optional<Tenant> found = tenantRepository.findByApiKeyHash(ApiKeyHasher.hash(apiKey));
        if (found.isEmpty()) {
            errorWriter.write(response, HttpServletResponse.SC_UNAUTHORIZED, RefusalMessages.INVALID_API_KEY);
            return;
        }

        Tenant tenant = found.get();
        if (!tenant.isActive()) {
            errorWriter.write(response, HttpServletResponse.SC_FORBIDDEN, RefusalMessages.TENANT_INACTIVE);
            return;
        }

        // ROLE_TENANT is what tenant routes require, which keeps a
        // tenant key and an admin token apart in the route rules.
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(tenant.getSchemaName(), null,
                        List.of(new SimpleGrantedAuthority("ROLE_TENANT"))));
        MDC.put("tenantSchema", tenant.getSchemaName());
        try (var _ = TenantContext.open(tenant.getSchemaName())) {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove("tenantSchema");
        }
    }
}
