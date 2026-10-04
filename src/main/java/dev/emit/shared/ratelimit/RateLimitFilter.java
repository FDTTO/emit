package dev.emit.shared.ratelimit;

import java.io.IOException;

import dev.emit.shared.multitenancy.TenantContext;
import dev.emit.shared.web.ApiErrorWriter;
import dev.emit.shared.web.RefusalMessages;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int UNAVAILABLE_RETRY_SECONDS = 5;

    private final RateLimiterService rateLimiterService;
    private final ApiErrorWriter errorWriter;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String tenantSchema = TenantContext.getTenant();

        // Only a tenant has a budget; login and the console pass through.
        if (tenantSchema == null) {
            filterChain.doFilter(request, response);
            return;
        }

        // Every tenant response says where the budget stands, so a client can
        // pace itself instead of learning the limit from a 429. Names follow
        // the IETF RateLimit header fields draft; Retry-After is RFC 9110's.
        RateLimitDecision decision;
        try {
            decision = rateLimiterService.tryConsume(tenantSchema);
        } catch (RateLimiterUnavailableException unavailable) {
            // Fails closed, as the server's fault: the tenant may well be within budget.
            response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(UNAVAILABLE_RETRY_SECONDS));
            errorWriter.write(response, HttpStatus.SERVICE_UNAVAILABLE.value(), RefusalMessages.LIMITER_UNAVAILABLE);
            return;
        }
        response.setHeader("RateLimit-Limit", String.valueOf(decision.limit()));
        response.setHeader("RateLimit-Remaining", String.valueOf(decision.remaining()));
        response.setHeader("RateLimit-Reset", String.valueOf(decision.resetSeconds()));

        if (!decision.allowed()) {
            response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(decision.resetSeconds()));
            errorWriter.write(
                    response,
                    HttpStatus.TOO_MANY_REQUESTS.value(),
                    RefusalMessages.rateLimited(decision.resetSeconds()));
            return;
        }

        filterChain.doFilter(request, response);
    }
}
