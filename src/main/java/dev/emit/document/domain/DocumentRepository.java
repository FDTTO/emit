package dev.emit.document.domain;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface DocumentRepository {

    Document save(Document document);

    Optional<Document> findById(UUID id);

    Page<Document> findAll(Pageable pageable);
}
