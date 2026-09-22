package dev.emit.shared.ratelimit;

import java.io.IOException;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import dev.emit.shared.multitenancy.TenantContext;
import dev.emit.shared.web.ApiErrorWriter;
import dev.emit.shared.web.RefusalMessages;
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
        if (tenantSchema == null) {
            filterChain.doFilter(request, response);
            return;
        }

        // Every tenant response says where the budget stands, so a client can
        // pace itself instead of learning the limit from a 429. Names follow
        // the IETF RateLimit header fields draft; Retry-After is RFC 9110's.
        RateLimitDecision decision = rateLimiterService.tryConsume(tenantSchema);
        response.setHeader("RateLimit-Limit", String.valueOf(decision.limit()));
        response.setHeader("RateLimit-Remaining", String.valueOf(decision.remaining()));
        response.setHeader("RateLimit-Reset", String.valueOf(decision.resetSeconds()));

        if (!decision.allowed()) {
            response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(decision.resetSeconds()));
            errorWriter.write(response, HttpStatus.TOO_MANY_REQUESTS.value(),
                    RefusalMessages.rateLimited(decision.resetSeconds()));
            return;
        }

        filterChain.doFilter(request, response);
    }
}
