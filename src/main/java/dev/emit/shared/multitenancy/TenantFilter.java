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

        try {
            String apiKey = request.getHeader("X-API-Key");

            if (apiKey != null) {
                String hash = ApiKeyHasher.hash(apiKey);
                Optional<Tenant> found = tenantRepository.findByApiKeyHash(hash);

                if (found.isEmpty()) {
                    errorWriter.write(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid API key.");
                    return;
                }

                Tenant tenant = found.get();

                if (!tenant.isActive()) {
                    errorWriter.write(response, HttpServletResponse.SC_FORBIDDEN, "Tenant is inactive.");
                    return;
                }

                TenantContext.setTenant(tenant.getSchemaName());
                MDC.put("tenantSchema", tenant.getSchemaName());
                // ROLE_TENANT is what tenant routes require, which keeps a
                // tenant key and an admin token apart in the route rules.
                SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken(tenant.getSchemaName(), null,
                                List.of(new SimpleGrantedAuthority("ROLE_TENANT"))));
            }

            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
            MDC.remove("tenantSchema");
        }
    }
}
