package dev.emit.document.domain;

import java.util.UUID;

public record DocumentGenerationRequestedEvent(UUID documentId, String tenantSchema) {
}
