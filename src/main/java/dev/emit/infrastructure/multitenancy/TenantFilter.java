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
        String apiKey = request.getHeader("X-API-Key");

        if (apiKey != null) {
            String hash = ApiKeyHasher.hash(apiKey);
            Optional<Tenant> tenant = tenantRepository.findByApiKeyHash(hash);
            tenant.ifPresent(t -> {
                TenantContext.setTenant(t.getSchemaName());
                MDC.put("tenantSchema", t.getSchemaName());
                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                        t.getSchemaName(), null, List.of());
                SecurityContextHolder.getContext().setAuthentication(auth);
            });
        }

        MDC.put("requestId", UUID.randomUUID().toString());

        try {
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
            MDC.clear();
        }
    }
}
