package dev.emit.shared.ratelimit;

import java.io.IOException;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import dev.emit.shared.multitenancy.TenantContext;
import dev.emit.shared.web.ApiErrorWriter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimiterService rateLimiterService;
    private final ApiErrorWriter errorWriter;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String tenantSchema = TenantContext.getTenant();

        // Only apply rate limiting when a tenant was identified from X-API-Key.
        // Requests without a tenant (e.g., /auth/login, /swagger-ui) pass through.
        if (tenantSchema != null && !rateLimiterService.tryConsume(tenantSchema)) {
            errorWriter.write(response, HttpStatus.TOO_MANY_REQUESTS.value(),
                    "Rate limit exceeded. Try again in a moment.");
            return;
        }

        filterChain.doFilter(request, response);
    }
}
