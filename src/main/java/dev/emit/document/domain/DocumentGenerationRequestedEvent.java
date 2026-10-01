package dev.emit.document.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DocumentGenerationRequestedEvent(UUID documentId, String tenantSchema, OffsetDateTime requestedAt) {
}
