package dev.emit.document.application;

public interface PdfRenderer {
    byte[] render(String html);
}
