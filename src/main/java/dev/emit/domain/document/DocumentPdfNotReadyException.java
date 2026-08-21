package dev.emit.domain.document;

import java.util.UUID;

public class DocumentPdfNotReadyException extends RuntimeException {

    public DocumentPdfNotReadyException(UUID documentId) {
        super("PDF not yet available for document: " + documentId);
    }
}
