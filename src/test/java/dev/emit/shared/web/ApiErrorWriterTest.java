package dev.emit.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

class ApiErrorWriterTest {

    private final ApiErrorWriter errorWriter =
            new ApiErrorWriter(new ObjectMapper().registerModule(new JavaTimeModule()));

    /**
     * The charset assertion is the point of this test: {@code getWriter()} falls
     * back to ISO-8859-1 when none is declared, which mangles accented text in
     * error messages. It is the kind of default that regresses silently, since
     * every ASCII-only message keeps working.
     */
    @Test
    void shouldDeclareJsonWithUtf8Charset() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        errorWriter.write(response, 401, "Unauthorized");

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentType()).isEqualTo("application/json;charset=UTF-8");
        assertThat(response.getCharacterEncoding()).isEqualTo(StandardCharsets.UTF_8.name());
    }

    @Test
    void shouldWriteStatusAndMessageInTheBody() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        errorWriter.write(response, 403, "Locatário inválido");

        String body = new String(response.getContentAsByteArray(), StandardCharsets.UTF_8);
        assertThat(body).contains("\"status\":403").contains("\"message\":\"Locatário inválido\"");
    }
}
