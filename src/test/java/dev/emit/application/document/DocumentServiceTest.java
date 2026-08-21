package dev.emit.application.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import dev.emit.domain.document.Document;
import dev.emit.domain.document.DocumentNotFoundException;
import dev.emit.domain.document.DocumentPdfNotReadyException;
import dev.emit.domain.document.DocumentRepository;
import dev.emit.infrastructure.messaging.DocumentEventPublisher;

@ExtendWith(MockitoExtension.class)
class DocumentServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private DocumentEventPublisher eventPublisher;

    @InjectMocks
    private DocumentService documentService;

    @Test
    void getPdfShouldReturnBytesWhenPdfIsReady() {
        UUID id = UUID.randomUUID();
        byte[] pdfBytes = new byte[] { 1, 2, 3 };
        Document doc = Document.create("Test", "Content");
        doc.markAsDone(pdfBytes);
        when(documentRepository.findById(id)).thenReturn(Optional.of(doc));

        byte[] result = documentService.getPdf(id);

        assertThat(result).isEqualTo(pdfBytes);
    }

    @Test
    void getPdfShouldThrowWhenPdfIsNull() {
        UUID id = UUID.randomUUID();
        Document doc = Document.create("Test", "Content");
        when(documentRepository.findById(id)).thenReturn(Optional.of(doc));

        assertThatThrownBy(() -> documentService.getPdf(id))
                .isInstanceOf(DocumentPdfNotReadyException.class);
    }

    @Test
    void getPdfShouldThrowWhenDocumentNotFound() {
        UUID id = UUID.randomUUID();
        when(documentRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> documentService.getPdf(id))
                .isInstanceOf(DocumentNotFoundException.class);
    }

    @Test
    void createShouldSaveDocumentAndPublishEvent() {
        Document saved = Document.create("Title", "Content");
        when(documentRepository.save(any())).thenReturn(saved);

        documentService.create("Title", "Content");

        verify(documentRepository).save(any());
        verify(eventPublisher).publishGenerationRequested(any());
    }
}
