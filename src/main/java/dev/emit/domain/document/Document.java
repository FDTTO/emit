package dev.emit.domain.document;

import java.time.OffsetDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@Getter
@Entity
@Table(name = "documents")
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private DocumentStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    public static Document create(String title, String content) {
        Document doc = new Document();
        doc.title = title;
        doc.content = content;
        doc.status = DocumentStatus.PENDING;
        doc.createdAt = OffsetDateTime.now();
        doc.updatedAt = doc.createdAt;
        return doc;
    }

    public void markAsProcessing() {
        this.status = DocumentStatus.PROCESSING;
        this.updatedAt = OffsetDateTime.now();
    }

    public void markAsDone() {
        this.status = DocumentStatus.DONE;
        this.updatedAt = OffsetDateTime.now();
    }

    public void markAsFailed() {
        this.status = DocumentStatus.FAILED;
        this.updatedAt = OffsetDateTime.now();
    }
}
