package dev.emit.infrastructure.pdf;

import java.io.ByteArrayOutputStream;

import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Component;
import org.xhtmlrenderer.pdf.ITextRenderer;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class FlyingSaucerPdfRenderer implements PdfRenderer {

    @Override
    @Retryable(retryFor = RuntimeException.class, maxAttempts = 3, backoff = @Backoff(delay = 500, multiplier = 2))
    public byte[] render(String html) {
        log.debug("Renderizando PDF...");
        try {
            ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
            ITextRenderer renderer = new ITextRenderer();
            renderer.setDocumentFromString(html);
            renderer.layout();
            renderer.createPDF(byteArrayOutputStream);
            return byteArrayOutputStream.toByteArray();

        } catch (Exception exception) {
            throw new RuntimeException("Erro ao renderizar PDF", exception);
        }
    }

    @Recover
    public byte[] recover(RuntimeException exception, String html) {
        log.error("Falha ao renderizar PDF após todas as tentativas: {}", exception.getMessage());
        throw new RuntimeException("PDF não pôde ser gerado após 3 tentativas", exception);
    }
}
