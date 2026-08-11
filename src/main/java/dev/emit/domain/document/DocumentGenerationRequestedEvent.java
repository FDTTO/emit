package dev.emit.domain.document;

import java.util.UUID;

public record DocumentGenerationRequestedEvent(UUID documentId, String tenantSchema) {
}
