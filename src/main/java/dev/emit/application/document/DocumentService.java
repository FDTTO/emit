package dev.emit.application.document;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import dev.emit.domain.document.Document;
import dev.emit.domain.document.DocumentGenerationRequestedEvent;
import dev.emit.domain.document.DocumentNotFoundException;
import dev.emit.domain.document.DocumentPdfNotReadyException;
import dev.emit.domain.document.DocumentRepository;
import dev.emit.infrastructure.messaging.DocumentEventPublisher;
import dev.emit.infrastructure.multitenancy.TenantContext;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final DocumentEventPublisher eventPublisher;

    public Page<Document> listAll(Pageable pageable) {
        return documentRepository.findAll(pageable);
    }

    @Transactional
    public Document create(String title, String content) {
        Document document = documentRepository.save(Document.create(title, content));
        eventPublisher.publishGenerationRequested(
                new DocumentGenerationRequestedEvent(document.getId(), TenantContext.getTenant()));
        return document;
    }

    public Document findById(UUID id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new DocumentNotFoundException(id));
    }

    public byte[] getPdf(UUID id) {
        Document document = findById(id);
        byte[] pdf = document.getPdfContent();
        if (pdf == null || pdf.length == 0) {
            throw new DocumentPdfNotReadyException(id);
        }
        return pdf;
    }
}
