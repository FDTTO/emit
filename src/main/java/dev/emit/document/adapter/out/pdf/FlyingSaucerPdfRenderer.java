package dev.emit.document.adapter.out.pdf;

import java.io.ByteArrayOutputStream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.xhtmlrenderer.pdf.ITextRenderer;

import dev.emit.document.application.PdfRenderer;

@Component
class FlyingSaucerPdfRenderer implements PdfRenderer {

    private static final Logger log = LoggerFactory.getLogger(FlyingSaucerPdfRenderer.class);

    @Override
    public byte[] render(String html) {
        log.debug("Rendering PDF...");
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ITextRenderer renderer = new ITextRenderer();
            renderer.setDocumentFromString(html);
            renderer.layout();
            renderer.createPDF(out);
            return out.toByteArray();
        } catch (Exception exception) {
            throw new PdfRenderException("Failed to render PDF", exception);
        }
    }
}
