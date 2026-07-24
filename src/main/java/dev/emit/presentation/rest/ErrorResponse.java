package dev.emit.presentation.rest;

import java.time.OffsetDateTime;

public record ErrorResponse(
        int status,
        String message,
        OffsetDateTime timestamp) {
}
