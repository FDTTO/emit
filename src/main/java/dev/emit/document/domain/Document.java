package dev.emit.document.domain;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
@Entity
@Table(name = "documents")
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "content", nullable = false)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private DocumentStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "pdf_content")
    @Getter(AccessLevel.NONE)
    private byte[] pdfContent;

    public static Document create(String title, String content) {
        if (title == null || title.isBlank())
            throw new IllegalArgumentException("Document title must not be blank");
        if (content == null || content.isBlank())
            throw new IllegalArgumentException("Document content must not be blank");

        Document document = new Document();
        document.title = title;
        document.content = content;
        document.status = DocumentStatus.PENDING;
        document.createdAt = OffsetDateTime.now(ZoneOffset.UTC);
        document.updatedAt = document.createdAt;
        return document;
    }

    public byte[] getPdfContent() {
        return pdfContent != null ? pdfContent.clone() : null;
    }

    public void markAsProcessing() {
        if (this.status != DocumentStatus.PENDING) {
            throw new IllegalStateException("Document must be PENDING to start processing, current: " + this.status);
        }
        this.status = DocumentStatus.PROCESSING;
        this.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public void markAsDone(byte[] pdfBytes) {
        if (this.status != DocumentStatus.PROCESSING) {
            throw new IllegalStateException("Document must be PROCESSING to mark as DONE, current: " + this.status);
        }
        if (pdfBytes == null || pdfBytes.length == 0) {
            throw new IllegalArgumentException("PDF content must not be empty");
        }
        this.pdfContent = pdfBytes.clone();
        this.status = DocumentStatus.DONE;
        this.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public void markAsFailed() {
        if (this.status != DocumentStatus.PENDING && this.status != DocumentStatus.PROCESSING) {
            throw new IllegalStateException("Cannot mark document as FAILED from state " + this.status);
        }
        this.status = DocumentStatus.FAILED;
        this.updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }
}
