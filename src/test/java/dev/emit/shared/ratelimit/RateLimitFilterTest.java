package dev.emit.shared.ratelimit;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import dev.emit.shared.multitenancy.TenantContext;
import dev.emit.shared.web.ApiErrorWriter;
import jakarta.servlet.FilterChain;

@ExtendWith(MockitoExtension.class)
class RateLimitFilterTest {

    @Mock
    private RateLimiterService rateLimiterService;

    @Mock
    private ApiErrorWriter errorWriter;

    @InjectMocks
    private RateLimitFilter rateLimitFilter;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldPassThroughWhenNoTenantInContext() throws Exception {
        FilterChain chain = mock(FilterChain.class);

        rateLimitFilter.doFilterInternal(new MockHttpServletRequest(), new MockHttpServletResponse(), chain);

        verify(rateLimiterService, never()).tryConsume(any());
        verify(chain).doFilter(any(), any());
    }

    @Test
    void shouldPassThroughWhenWithinRateLimit() throws Exception {
        TenantContext.setTenant("tenant_abc");
        when(rateLimiterService.tryConsume("tenant_abc")).thenReturn(true);
        FilterChain chain = mock(FilterChain.class);

        rateLimitFilter.doFilterInternal(new MockHttpServletRequest(), new MockHttpServletResponse(), chain);

        verify(chain).doFilter(any(), any());
    }

    @Test
    void shouldReturn429WhenRateLimitExceeded() throws Exception {
        TenantContext.setTenant("tenant_abc");
        when(rateLimiterService.tryConsume("tenant_abc")).thenReturn(false);
        FilterChain chain = mock(FilterChain.class);

        rateLimitFilter.doFilterInternal(new MockHttpServletRequest(), new MockHttpServletResponse(), chain);

        verify(errorWriter).write(any(), eq(429), any());
        verify(chain, never()).doFilter(any(), any());
    }
}
