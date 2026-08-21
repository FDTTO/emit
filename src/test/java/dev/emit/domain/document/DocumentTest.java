package dev.emit.domain.document;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DocumentTest {

    @Test
    void createShouldSetPendingStatusAndTimestamps() {
        Document doc = Document.create("Contract", "Content");

        assertThat(doc.getTitle()).isEqualTo("Contract");
        assertThat(doc.getContent()).isEqualTo("Content");
        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.PENDING);
        assertThat(doc.getCreatedAt()).isNotNull();
        assertThat(doc.getUpdatedAt()).isNotNull();
    }

    @Test
    void markAsProcessingShouldUpdateStatusAndTimestamp() {
        Document doc = Document.create("Contract", "Content");

        doc.markAsProcessing();

        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.PROCESSING);
        assertThat(doc.getUpdatedAt()).isNotNull();
    }

    @Test
    void markAsDoneShouldUpdateStatusAndTimestampAndStorePdf() {
        Document doc = Document.create("Contract", "Content");
        byte[] pdfBytes = new byte[] { 1, 2, 3 };

        doc.markAsDone(pdfBytes);

        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.DONE);
        assertThat(doc.getUpdatedAt()).isNotNull();
        assertThat(doc.getPdfContent()).isEqualTo(pdfBytes);
    }

    @Test
    void markAsFailedShouldUpdateStatusAndTimestamp() {
        Document doc = Document.create("Contract", "Content");

        doc.markAsFailed();

        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.FAILED);
        assertThat(doc.getUpdatedAt()).isNotNull();
    }
}
