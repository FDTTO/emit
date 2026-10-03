package dev.emit.document.application;

import java.time.OffsetDateTime;
import java.util.UUID;

import dev.emit.document.domain.Document;
import dev.emit.document.domain.DocumentNotFoundException;
import dev.emit.document.domain.DocumentRepository;
import dev.emit.document.domain.DocumentStatus;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class PdfGenerationService {

    private static final Logger log = LoggerFactory.getLogger(PdfGenerationService.class);

    private final DocumentRepository documentRepository;
    private final DocumentTemplateRenderer templateRenderer;
    private final PdfRenderer pdfRenderer;
    private final TransactionTemplate transactionTemplate;

    @Transactional
    public void abandonGeneration(UUID id) {
        Document document = documentRepository.findById(id).orElseThrow(() -> new DocumentNotFoundException(id));
        if (document.getStatus() == DocumentStatus.FAILED || document.getStatus() == DocumentStatus.DONE) {
            log.warn("Document already in terminal state {}, skipping documentId={}", document.getStatus(), id);
            return;
        }
        document.markAsFailed();
        documentRepository.save(document);
        log.warn("Document generation permanently abandoned documentId={}", id);
    }

    // Not @Transactional: PDF rendering can take seconds. Holding a DB connection
    // for the entire render exhausts the pool under load. Two short transactions
    // bracket the long I/O operation instead.
    // A failed attempt leaves the document PROCESSING so the retry renders again;
    // only the dead-letter handler marks it FAILED. A finished document means a
    // duplicate request (generate called twice) and is skipped, not retried.
    public void generateSync(UUID id, OffsetDateTime requestedAt) {
        Document document = transactionTemplate.execute(tx -> {
            Document fetched = documentRepository.findById(id).orElseThrow(() -> new DocumentNotFoundException(id));
            if (fetched.getStatus() == DocumentStatus.PENDING) {
                fetched.markAsProcessing(requestedAt);
                return documentRepository.save(fetched);
            }
            return fetched;
        });

        if (document.getStatus() == DocumentStatus.DONE || document.getStatus() == DocumentStatus.FAILED) {
            log.warn(
                    "Document already {}, skipping duplicate generation request documentId={}",
                    document.getStatus(),
                    id);
            return;
        }

        log.info("PDF generation started documentId={}", id);

        String html = templateRenderer.render(document);

        byte[] pdfBytes;
        try {
            pdfBytes = pdfRenderer.render(html);
        } catch (Exception exception) {
            throw new PdfGenerationException("Failed to generate PDF for document " + id, exception);
        }
        transactionTemplate.execute(tx -> {
            document.markAsDone(pdfBytes);
            documentRepository.save(document);
            return null;
        });
        log.info("PDF generation completed documentId={}", id);
    }
}
