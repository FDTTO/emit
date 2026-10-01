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
        @Schema(description = "When the generation request was accepted and queued in Kafka. Null until a worker picks it up.",
                example = "2026-01-15T10:31:00.120Z", nullable = true)
        OffsetDateTime queuedAt,
        @Schema(description = "When a worker picked the request up. Time queued is startedAt minus queuedAt.",
                example = "2026-01-15T10:31:00.410Z", nullable = true)
        OffsetDateTime startedAt,
        @Schema(description = "When the document reached DONE or FAILED. Time rendering is finishedAt minus startedAt.",
                example = "2026-01-15T10:31:01.380Z", nullable = true)
        OffsetDateTime finishedAt,
        @Schema(example = "2026-01-15T10:31:01.380Z")
        OffsetDateTime updatedAt) {

    public static DocumentResponse from(Document document) {
        return new DocumentResponse(
                document.getId(),
                document.getTitle(),
                document.getContent(),
                document.getStatus(),
                document.getCreatedAt(),
                document.getQueuedAt(),
                document.getStartedAt(),
                document.getFinishedAt(),
                document.getUpdatedAt());
    }
}
