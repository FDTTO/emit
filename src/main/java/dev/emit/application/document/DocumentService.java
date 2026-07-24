package dev.emit.application.document;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import dev.emit.domain.document.Document;
import dev.emit.domain.document.DocumentRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;

    public List<Document> listAll() {
        return documentRepository.findAll();
    }

    @Transactional
    public Document create(String title, String content) {
        Document document = new Document();
        document.setTitle(title);
        document.setContent(content);
        document.setStatus("PENDING");
        document.setCreatedAt(OffsetDateTime.now());
        return documentRepository.save(document);
    }

    public Optional<Document> findById(UUID id) {
        return documentRepository.findById(id);
    }
}
