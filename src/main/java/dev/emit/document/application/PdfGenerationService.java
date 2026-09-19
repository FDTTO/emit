package dev.emit.document.application;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import dev.emit.document.domain.Document;
import dev.emit.document.domain.DocumentNotFoundException;
import dev.emit.document.domain.DocumentRepository;
import dev.emit.document.domain.DocumentStatus;
import lombok.RequiredArgsConstructor;

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
        Document document = documentRepository.findById(id)
                .orElseThrow(() -> new DocumentNotFoundException(id));
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
    // The PROCESSING branch makes this idempotent for @RetryableTopic retries:
    // if a prior attempt failed after markAsProcessing() was committed, the next
    // attempt skips the state transition and proceeds directly to rendering.
    public void generateSync(UUID id) {
        Document document = transactionTemplate.execute(tx -> {
            Document fetched = documentRepository.findById(id)
                    .orElseThrow(() -> new DocumentNotFoundException(id));
            if (fetched.getStatus() == DocumentStatus.PENDING) {
                fetched.markAsProcessing();
                return documentRepository.save(fetched);
            } else if (fetched.getStatus() == DocumentStatus.PROCESSING) {
                return fetched;
            } else {
                throw new IllegalStateException(
                        "Cannot generate PDF for document in state " + fetched.getStatus() + ": " + id);
            }
        });

        log.info("PDF generation started documentId={}", id);

        String html = templateRenderer.render(document);

        try {
            byte[] pdfBytes = pdfRenderer.render(html);
            transactionTemplate.execute(tx -> {
                document.markAsDone(pdfBytes);
                documentRepository.save(document);
                return null;
            });
            log.info("PDF generation completed documentId={}", id);
        } catch (Exception exception) {
            transactionTemplate.execute(tx -> {
                document.markAsFailed();
                documentRepository.save(document);
                return null;
            });
            throw new PdfGenerationException("Failed to generate PDF for document " + id, exception);
        }
    }
}
