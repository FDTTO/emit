package dev.emit.infrastructure.pdf;

public interface PdfRenderer {
    byte[] render(String html);
}
