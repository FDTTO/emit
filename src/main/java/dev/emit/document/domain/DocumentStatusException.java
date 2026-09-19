package dev.emit.document.domain;

import java.util.UUID;

public class DocumentStatusException extends RuntimeException {

    public DocumentStatusException(UUID id, DocumentStatus required, DocumentStatus current) {
        super("Document must be " + required + " but is " + current + ": " + id);
    }
}
