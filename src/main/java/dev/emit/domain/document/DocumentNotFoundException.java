package dev.emit.domain.document;

import java.util.UUID;

public class DocumentNotFoundException extends RuntimeException {

    public DocumentNotFoundException(UUID id) {
        super("Documento não econtrado: " + id);
    }

}
