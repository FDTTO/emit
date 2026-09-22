package dev.emit.document.adapter.in.rest;

import java.time.OffsetDateTime;
import java.util.UUID;

import dev.emit.document.domain.Document;
import dev.emit.document.domain.DocumentStatus;
import io.swagger.v3.oas.annotations.media.Schema;

public record DocumentResponse(
        UUID id,
        @Schema(example = "Q3 Invoice")
        String title,
        @Schema(example = "<h1>Invoice</h1><p>Total: $1,200.00</p>")
        String content,
        @Schema(description = "Current processing status. PENDING → PROCESSING → DONE (or FAILED).")
        DocumentStatus status,
        @Schema(example = "2026-01-15T10:30:00Z")
        OffsetDateTime createdAt,
        @Schema(example = "2026-01-15T10:30:00Z")
        OffsetDateTime updatedAt) {

    public static DocumentResponse from(Document document) {
        return new DocumentResponse(
                document.getId(),
                document.getTitle(),
                document.getContent(),
                document.getStatus(),
                document.getCreatedAt(),
                document.getUpdatedAt());
    }
}
