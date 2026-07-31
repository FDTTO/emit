package dev.emit.presentation.rest.document;

import java.time.OffsetDateTime;
import java.util.UUID;

import dev.emit.domain.document.Document;
import dev.emit.domain.document.DocumentStatus;

public record DocumentResponse(
        UUID id,
        String title,
        String content,
        DocumentStatus status,
        OffsetDateTime createdAt) {
    public static DocumentResponse from(Document document) {
        return new DocumentResponse(
                document.getId(),
                document.getTitle(),
                document.getContent(),
                document.getStatus(),
                document.getCreatedAt());
    }
}
