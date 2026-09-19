package dev.emit.document.domain;

import java.util.UUID;

public class DocumentPdfNotReadyException extends RuntimeException {

    public DocumentPdfNotReadyException(UUID id) {
        super("PDF not yet available for document: " + id);
    }
}
