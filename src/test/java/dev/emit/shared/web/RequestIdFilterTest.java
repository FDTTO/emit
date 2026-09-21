package dev.emit.shared.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import jakarta.servlet.Filter;
import jakarta.servlet.Servlet;

class RequestIdFilterTest {

    private final RequestIdFilter filter = new RequestIdFilter();

    @Test
    void shouldReturnTheIdItLogsUnder() throws Exception {
        String[] logged = new String[1];
        Filter capture = (req, res, chain) -> logged[0] = MDC.get("requestId");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(new MockHttpServletRequest(), response, new MockFilterChain(mock(Servlet.class), capture));

        String sent = response.getHeader("X-Request-Id");
        assertThat(sent).isNotBlank().isEqualTo(logged[0]);
        assertThat(UUID.fromString(sent)).isNotNull();
    }

    @Test
    void shouldGiveEveryRequestItsOwnId() throws Exception {
        MockHttpServletResponse first = new MockHttpServletResponse();
        MockHttpServletResponse second = new MockHttpServletResponse();

        filter.doFilter(new MockHttpServletRequest(), first, new MockFilterChain());
        filter.doFilter(new MockHttpServletRequest(), second, new MockFilterChain());

        assertThat(first.getHeader("X-Request-Id")).isNotEqualTo(second.getHeader("X-Request-Id"));
    }

    @Test
    void shouldClearTheIdEvenWhenTheRequestFails() {
        Filter failing = (req, res, chain) -> {
            throw new IllegalStateException("downstream failure");
        };

        assertThatThrownBy(() -> filter.doFilter(new MockHttpServletRequest(), new MockHttpServletResponse(),
                new MockFilterChain(mock(Servlet.class), failing)))
                .hasMessage("downstream failure");
        assertThat(MDC.get("requestId")).isNull();
    }
}
