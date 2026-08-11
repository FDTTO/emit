package dev.emit.application.document;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import dev.emit.domain.document.Document;
import dev.emit.domain.document.DocumentNotFoundException;
import dev.emit.domain.document.DocumentRepository;
import dev.emit.infrastructure.pdf.PdfRenderer;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PdfGenerationService {

    private final DocumentRepository documentRepository;
    private final TemplateEngine templateEngine;
    private final PdfRenderer pdfRenderer;

    public void generateSync(UUID documentId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new DocumentNotFoundException(documentId));

        document.markAsProcessing();
        documentRepository.save(document);

        Context context = new Context();
        context.setVariable("document", document);
        context.setVariable("generatedAt",
                OffsetDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")));

        String html = templateEngine.process("document-pdf", context);

        try {
            pdfRenderer.render(html);
            document.markAsDone();
            documentRepository.save(document);
        } catch (Exception exception) {
            document.markAsFailed();
            documentRepository.save(document);
            throw new RuntimeException("Failed to generate PDF", exception);
        }
    }
}
