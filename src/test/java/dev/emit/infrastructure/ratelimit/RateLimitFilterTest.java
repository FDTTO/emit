package dev.emit.infrastructure.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
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

import com.fasterxml.jackson.databind.ObjectMapper;

import dev.emit.infrastructure.multitenancy.TenantContext;
import jakarta.servlet.FilterChain;

@ExtendWith(MockitoExtension.class)
class RateLimitFilterTest {

    @Mock
    private RateLimiterService rateLimiterService;

    @Mock
    private ObjectMapper objectMapper;

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
        MockHttpServletResponse response = new MockHttpServletResponse();

        rateLimitFilter.doFilterInternal(new MockHttpServletRequest(), response, chain);

        assertThat(response.getStatus()).isEqualTo(429);
        verify(chain, never()).doFilter(any(), any());
    }
}
