package dev.emit.infrastructure.ratelimit;

import java.io.IOException;
import java.time.OffsetDateTime;

import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;

import dev.emit.infrastructure.multitenancy.TenantContext;
import dev.emit.presentation.rest.ErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@Order(2)
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimiterService rateLimiterService;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String tenantSchema = TenantContext.getTenant();

        // Only apply rate limiting when a tenant was identified from X-API-Key.
        // Requests without a tenant (e.g., /auth/login, /swagger-ui) pass through.
        if (tenantSchema != null && !rateLimiterService.tryConsume(tenantSchema)) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(response.getWriter(),
                    new ErrorResponse(429, "Rate limit exceeded. Try again in a moment.", OffsetDateTime.now()));
            return;
        }

        filterChain.doFilter(request, response);
    }
}
