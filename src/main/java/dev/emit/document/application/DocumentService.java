package dev.emit.document.application;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import dev.emit.document.domain.Document;
import dev.emit.document.domain.DocumentGenerationRequestedEvent;
import dev.emit.document.domain.DocumentNotFoundException;
import dev.emit.document.domain.DocumentPdfNotReadyException;
import dev.emit.document.domain.DocumentRepository;
import dev.emit.document.domain.DocumentStatus;
import dev.emit.document.domain.DocumentStatusException;
import dev.emit.shared.multitenancy.TenantContext;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);

    private final DocumentRepository documentRepository;
    private final DocumentEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public Page<Document> listAll(Pageable pageable) {
        return documentRepository.findAll(pageable);
    }

    @Transactional
    public Document create(String title, String content) {
        Document saved = documentRepository.save(Document.create(title, content));
        log.info("Document created documentId={} tenant={}", saved.getId(), TenantContext.getTenant());
        return saved;
    }

    @Transactional(readOnly = true)
    public Document findById(UUID id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new DocumentNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public void requestGeneration(UUID id) {
        Document document = findById(id);
        if (document.getStatus() != DocumentStatus.PENDING) {
            throw new DocumentStatusException(id, DocumentStatus.PENDING, document.getStatus());
        }
        log.info("Requesting PDF generation documentId={} tenant={}", id, TenantContext.getTenant());
        eventPublisher.publishGenerationRequested(
                new DocumentGenerationRequestedEvent(id, TenantContext.getTenant()));
    }

    @Transactional(readOnly = true)
    public byte[] getPdf(UUID id) {
        Document document = findById(id);
        byte[] pdfBytes = document.getPdfContent();
        if (pdfBytes == null || pdfBytes.length == 0) {
            throw new DocumentPdfNotReadyException(id);
        }
        return pdfBytes;
    }
}
