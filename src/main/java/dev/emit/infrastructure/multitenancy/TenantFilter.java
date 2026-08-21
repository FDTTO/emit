package dev.emit.infrastructure.multitenancy;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import dev.emit.domain.tenant.Tenant;
import dev.emit.domain.tenant.TenantRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class TenantFilter extends OncePerRequestFilter {

    private final TenantRepository tenantRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        MDC.put("requestId", UUID.randomUUID().toString());

        try {
            String apiKey = request.getHeader("X-API-Key");

            if (apiKey != null) {
                String hash = ApiKeyHasher.hash(apiKey);
                Optional<Tenant> found = tenantRepository.findByApiKeyHash(hash);

                if (found.isEmpty()) {
                    sendError(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid API key.");
                    return;
                }

                Tenant tenant = found.get();

                if (!tenant.isActive()) {
                    sendError(response, HttpServletResponse.SC_FORBIDDEN, "Tenant is inactive.");
                    return;
                }

                TenantContext.setTenant(tenant.getSchemaName());
                MDC.put("tenantSchema", tenant.getSchemaName());
                SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken(tenant.getSchemaName(), null, List.of()));
            }

            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
            MDC.clear();
        }
    }

    private void sendError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"status\":" + status + ",\"message\":\"" + message + "\"}");
    }
}
