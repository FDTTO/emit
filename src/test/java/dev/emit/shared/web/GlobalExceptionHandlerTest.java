package dev.emit.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.FileNotFoundException;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.servlet.resource.ResourceHttpRequestHandler;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    /**
     * Guards the boundary between "no such URL" and "the server broke". Both
     * map to the same generic handler unless this one claims the exception
     * first, and a 500 on a typo is both wrong for the caller and noise in the
     * error log.
     */
    @Test
    void shouldReturn404ForUnknownPath() {
        ResponseEntity<ErrorResponse> response =
                handler.handleNoResource(new NoResourceFoundException(HttpMethod.GET, "/does-not-exist"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(404);
    }

    /**
     * A static file that was served once and then removed comes back as a
     * `FileNotFoundException` from the cached handle rather than as Spring's
     * own not-found exception. The caller still asked for something that is not
     * there.
     */
    @Test
    void shouldReturn404WhenAServedStaticResourceDisappears() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/swagger/theme.css");
        request.setAttribute(HandlerMapping.BEST_MATCHING_HANDLER_ATTRIBUTE, new ResourceHttpRequestHandler());

        ResponseEntity<ErrorResponse> response =
                handler.handleMissingStaticResource(new FileNotFoundException("theme.css"), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(404);
    }

    /**
     * The narrowing that keeps the handler above honest: a missing file the
     * server expected to have, a PDF template or a font, is a real fault and
     * has to stay a 500 rather than telling the caller they asked for the
     * wrong URL.
     */
    @Test
    void shouldReturn500WhenAFileIsMissingOutsideResourceHandling() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/documents");

        ResponseEntity<ErrorResponse> response =
                handler.handleMissingStaticResource(new FileNotFoundException("report-template.html"), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(500);
    }

    @Test
    void shouldReturn500ForUnexpectedFailures() {
        ResponseEntity<ErrorResponse> response = handler.handleGeneric(new IllegalStateException("boom"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(500);
    }

    /**
     * The message is deliberately not the exception's: an unexpected failure
     * can carry internals in its message, and those do not belong in a response.
     */
    @Test
    void shouldNotLeakInternalDetailInTheGenericMessage() {
        ResponseEntity<ErrorResponse> response =
                handler.handleGeneric(new IllegalStateException("jdbc url password=hunter2"));

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().message()).doesNotContain("hunter2");
    }
}
