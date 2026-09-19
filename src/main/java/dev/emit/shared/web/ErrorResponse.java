package dev.emit.shared.web;

import java.time.OffsetDateTime;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "The body of every error the API returns.")
public record ErrorResponse(
        @Schema(description = "HTTP status code, repeated in the body.", example = "404")
        int status,
        @Schema(description = "What went wrong, in terms the caller can act on.", example = "Document not found.")
        String message,
        @Schema(description = "When the error was produced, in UTC.", example = "2026-01-15T10:30:00Z")
        OffsetDateTime timestamp) {
}
