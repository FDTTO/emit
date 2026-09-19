package dev.emit.shared.web;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

/**
 * Writes error bodies for the security layer, which runs in the filter chain
 * and so cannot go through Spring's message converters the way a controller
 * response does. It serialises the same {@link ErrorResponse} the controller
 * advice returns, so a client sees one error shape regardless of how far into
 * the request the failure happened.
 */
@Component
@RequiredArgsConstructor
public class ApiErrorWriter {

    private final ObjectMapper objectMapper;

    public void write(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        // Explicit charset: without one, `getWriter()` falls back to ISO-8859-1
        // (Servlet spec) and non-ASCII text in the JSON body is mangled.
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(),
                new ErrorResponse(status, message, OffsetDateTime.now(ZoneOffset.UTC)));
    }
}
