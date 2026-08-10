package dev.emit.application.document;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import dev.emit.domain.document.Document;
import dev.emit.domain.document.DocumentRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;

    public Page<Document> listAll(Pageable pageable) {
        return documentRepository.findAll(pageable);
    }

    @Transactional
    public Document create(String title, String content) {
        return documentRepository.save(Document.create(title, content));
    }

    public Optional<Document> findById(UUID id) {
        return documentRepository.findById(id);
    }
}
