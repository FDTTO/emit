package dev.emit.document.adapter.out.pdf;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.xhtmlrenderer.pdf.ITextOutputDevice;

import com.lowagie.text.pdf.BaseFont;
import org.xhtmlrenderer.pdf.ITextRenderer;
import org.xhtmlrenderer.pdf.ITextUserAgent;

import dev.emit.document.application.PdfRenderer;

@Component
class FlyingSaucerPdfRenderer implements PdfRenderer {

    private static final Logger log = LoggerFactory.getLogger(FlyingSaucerPdfRenderer.class);

    // Classpath resources, read by the PDF library itself rather than through the
    // offline user agent below. Latin subsets: the coverage the built-in fonts had.
    private static final List<String> FONTS = List.of(
            "fonts/Inter-400.ttf", "fonts/Inter-600.ttf", "fonts/Inter-700.ttf",
            "fonts/JetBrainsMono-400.ttf", "fonts/JetBrainsMono-500.ttf");

    @Override
    public byte[] render(String html) {
        log.debug("Rendering PDF...");
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ITextRenderer renderer = new ITextRenderer();
            for (String font : FONTS) {
                renderer.getFontResolver().addFont(font, BaseFont.IDENTITY_H, BaseFont.EMBEDDED);
            }
            OfflineUserAgent userAgent = new OfflineUserAgent(renderer.getOutputDevice());
            userAgent.setSharedContext(renderer.getSharedContext());
            renderer.getSharedContext().setUserAgentCallback(userAgent);
            renderer.setDocumentFromString(html);
            renderer.layout();
            renderer.createPDF(out);
            return out.toByteArray();
        } catch (Exception exception) {
            throw new PdfRenderException("Failed to render PDF", exception);
        }
    }

    /*
     * Document content is tenant-supplied HTML, and the renderer would
     * otherwise open every URL it references: images, stylesheets, anything
     * the server can reach. The template needs no external resource, so none
     * is fetched. Embedded data: images are decoded without opening a stream.
     */
    private static final class OfflineUserAgent extends ITextUserAgent {

        OfflineUserAgent(ITextOutputDevice outputDevice) {
            super(outputDevice);
        }

        @Override
        protected InputStream openStream(String uri) throws IOException {
            log.warn("Blocked external resource in document content: {}", uri);
            throw new IOException("External resources are disabled: " + uri);
        }
    }
}
