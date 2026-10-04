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

    @Test
    void shouldReturn404ForUnknownPath() {
        ResponseEntity<ErrorResponse> response = handler.handleNoResource(
                new NoResourceFoundException(HttpMethod.GET, "/does-not-exist", "does-not-exist"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(404);
    }

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

    @Test
    void shouldNotLeakInternalDetailInTheGenericMessage() {
        ResponseEntity<ErrorResponse> response =
                handler.handleGeneric(new IllegalStateException("jdbc url password=hunter2"));

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().message()).doesNotContain("hunter2");
    }
}
