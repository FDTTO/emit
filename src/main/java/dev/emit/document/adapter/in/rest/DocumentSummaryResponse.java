package dev.emit.document.adapter.in.rest;

import java.time.OffsetDateTime;
import java.util.UUID;

import dev.emit.document.domain.Document;
import dev.emit.document.domain.DocumentStatus;

public record DocumentSummaryResponse(
        UUID id,
        String title,
        DocumentStatus status,
        OffsetDateTime createdAt) {

    public static DocumentSummaryResponse from(Document document) {
        return new DocumentSummaryResponse(
                document.getId(),
                document.getTitle(),
                document.getStatus(),
                document.getCreatedAt());
    }
}
