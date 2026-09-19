package dev.emit.document.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

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

    @ParameterizedTest
    @CsvSource({ "'', Content", "' ', Content", "Title, ''", "Title, ' '" })
    void createShouldThrowWhenInputIsBlank(String title, String content) {
        assertThatThrownBy(() -> Document.create(title, content))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void markAsProcessingShouldUpdateStatusAndTimestamp() {
        Document doc = Document.create("Contract", "Content");
        OffsetDateTime before = doc.getUpdatedAt();

        doc.markAsProcessing();

        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.PROCESSING);
        assertThat(doc.getUpdatedAt()).isAfterOrEqualTo(before);
    }

    @Test
    void markAsDoneShouldUpdateStatusAndStorePdf() {
        Document doc = Document.create("Contract", "Content");
        doc.markAsProcessing();
        byte[] pdfBytes = new byte[] { 1, 2, 3 };

        doc.markAsDone(pdfBytes);

        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.DONE);
        assertThat(doc.getPdfContent()).isEqualTo(pdfBytes);
    }

    @Test
    void markAsFailedShouldUpdateStatus() {
        Document doc = Document.create("Contract", "Content");
        doc.markAsProcessing();

        doc.markAsFailed();

        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.FAILED);
    }

    @Test
    void markAsFailedShouldSucceedFromPending() {
        Document doc = Document.create("Contract", "Content");

        doc.markAsFailed();

        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.FAILED);
    }

    @Test
    void markAsProcessingShouldThrowWhenNotPending() {
        Document doc = Document.create("Contract", "Content");
        doc.markAsProcessing();

        assertThatThrownBy(doc::markAsProcessing)
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void markAsDoneShouldThrowWhenNotProcessing() {
        Document doc = Document.create("Contract", "Content");

        assertThatThrownBy(() -> doc.markAsDone(new byte[] { 1 }))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void markAsDoneShouldThrowWhenPdfIsNull() {
        Document doc = Document.create("Contract", "Content");
        doc.markAsProcessing();

        assertThatThrownBy(() -> doc.markAsDone(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void markAsFailedShouldThrowWhenDone() {
        Document doc = Document.create("Contract", "Content");
        doc.markAsProcessing();
        doc.markAsDone(new byte[] { 1 });

        assertThatThrownBy(doc::markAsFailed)
                .isInstanceOf(IllegalStateException.class);
    }
}
