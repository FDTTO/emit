package dev.emit.document.application;

import dev.emit.document.domain.Document;

public interface DocumentTemplateRenderer {
    String render(Document document);
}
