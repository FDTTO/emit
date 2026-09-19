package dev.emit.document.application;

import dev.emit.document.domain.DocumentGenerationRequestedEvent;

public interface DocumentEventPublisher {
    void publishGenerationRequested(DocumentGenerationRequestedEvent event);
}
