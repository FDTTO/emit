package dev.emit.document.adapter.out.pdf;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.xhtmlrenderer.pdf.ITextOutputDevice;
import org.xhtmlrenderer.pdf.ITextRenderer;
import org.xhtmlrenderer.pdf.ITextUserAgent;

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
