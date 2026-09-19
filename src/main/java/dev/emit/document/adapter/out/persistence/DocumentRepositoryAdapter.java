package dev.emit.document.adapter.out.persistence;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import dev.emit.document.domain.Document;
import dev.emit.document.domain.DocumentRepository;

interface DocumentRepositoryAdapter extends JpaRepository<Document, UUID>, DocumentRepository {
}
