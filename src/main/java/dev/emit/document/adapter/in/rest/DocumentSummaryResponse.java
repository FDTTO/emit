package dev.emit.document.adapter.in.rest;

import java.time.OffsetDateTime;
import java.util.UUID;

import dev.emit.document.domain.Document;
import dev.emit.document.domain.DocumentStatus;
import io.swagger.v3.oas.annotations.media.Schema;

public record DocumentSummaryResponse(
        UUID id,
        @Schema(example = "Q3 Invoice")
        String title,
        DocumentStatus status,
        @Schema(example = "2026-01-15T10:30:00Z")
        OffsetDateTime createdAt) {

    public static DocumentSummaryResponse from(Document document) {
        return new DocumentSummaryResponse(
                document.getId(),
                document.getTitle(),
                document.getStatus(),
                document.getCreatedAt());
    }
}
