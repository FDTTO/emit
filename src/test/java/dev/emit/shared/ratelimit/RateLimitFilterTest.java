package dev.emit.shared.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
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
    void shouldPassThroughAndPublishTheBudgetWhenWithinRateLimit() throws Exception {
        TenantContext.setTenant("tenant_abc");
        when(rateLimiterService.tryConsume("tenant_abc")).thenReturn(new RateLimitDecision(true, 20, 7, 42));
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        rateLimitFilter.doFilterInternal(new MockHttpServletRequest(), response, chain);

        verify(chain).doFilter(any(), any());
        assertThat(response.getHeader("RateLimit-Limit")).isEqualTo("20");
        assertThat(response.getHeader("RateLimit-Remaining")).isEqualTo("7");
        assertThat(response.getHeader("RateLimit-Reset")).isEqualTo("42");
        assertThat(response.getHeader("Retry-After")).isNull();
    }

    @Test
    void shouldReturn429SayingWhenToRetryWhenRateLimitExceeded() throws Exception {
        TenantContext.setTenant("tenant_abc");
        when(rateLimiterService.tryConsume("tenant_abc")).thenReturn(new RateLimitDecision(false, 20, 0, 13));
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        rateLimitFilter.doFilterInternal(new MockHttpServletRequest(), response, chain);

        verify(errorWriter).write(any(), eq(429), contains("13 seconds"));
        verify(chain, never()).doFilter(any(), any());
        assertThat(response.getHeader("Retry-After")).isEqualTo("13");
        assertThat(response.getHeader("RateLimit-Remaining")).isEqualTo("0");
    }
}
