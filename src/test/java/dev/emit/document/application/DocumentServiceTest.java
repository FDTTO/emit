package dev.emit.document.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import dev.emit.document.domain.Document;
import dev.emit.document.domain.DocumentNotFoundException;
import dev.emit.document.domain.DocumentPdfNotReadyException;
import dev.emit.document.domain.DocumentRepository;
import dev.emit.document.domain.DocumentStatusException;

@ExtendWith(MockitoExtension.class)
class DocumentServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private DocumentEventPublisher eventPublisher;

    @InjectMocks
    private DocumentService documentService;

    @Test
    void createShouldSaveWithoutPublishingEvent() {
        Document document = Document.create("Title", "Content");
        when(documentRepository.save(any())).thenReturn(document);

        Document result = documentService.create("Title", "Content");

        verify(documentRepository).save(any());
        verify(eventPublisher, never()).publishGenerationRequested(any());
        assertThat(result).isEqualTo(document);
    }

    @Test
    void requestGenerationShouldPublishEvent() {
        UUID id = UUID.randomUUID();
        Document document = Document.create("Title", "Content");
        when(documentRepository.findById(id)).thenReturn(Optional.of(document));

        documentService.requestGeneration(id);

        verify(eventPublisher).publishGenerationRequested(argThat(event -> id.equals(event.documentId())));
    }

    @Test
    void requestGenerationShouldThrowWhenDocumentNotFound() {
        UUID id = UUID.randomUUID();
        when(documentRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> documentService.requestGeneration(id))
                .isInstanceOf(DocumentNotFoundException.class);
    }

    @Test
    void requestGenerationShouldThrowWhenDocumentIsNotPending() {
        UUID id = UUID.randomUUID();
        Document document = Document.create("Title", "Content");
        document.markAsProcessing();
        when(documentRepository.findById(id)).thenReturn(Optional.of(document));

        assertThatThrownBy(() -> documentService.requestGeneration(id))
                .isInstanceOf(DocumentStatusException.class);

        verify(eventPublisher, never()).publishGenerationRequested(any());
    }

    @Test
    void getPdfShouldReturnBytesWhenPdfIsReady() {
        UUID id = UUID.randomUUID();
        byte[] pdfBytes = new byte[] { 1, 2, 3 };
        Document document = Document.create("Test", "Content");
        document.markAsProcessing();
        document.markAsDone(pdfBytes);
        when(documentRepository.findById(id)).thenReturn(Optional.of(document));

        byte[] result = documentService.getPdf(id);

        assertThat(result).isEqualTo(pdfBytes);
    }

    @Test
    void getPdfShouldThrowWhenPdfIsNull() {
        UUID id = UUID.randomUUID();
        Document document = Document.create("Test", "Content");
        when(documentRepository.findById(id)).thenReturn(Optional.of(document));

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
    void listAllShouldDelegateToRepository() {
        when(documentRepository.findAll(any(Pageable.class)))
                .thenReturn(Page.empty());

        Page<Document> result = documentService.listAll(Pageable.unpaged());

        assertThat(result).isEmpty();
        verify(documentRepository).findAll(any(Pageable.class));
    }

    @Test
    void findByIdShouldThrowWhenNotFound() {
        UUID id = UUID.randomUUID();
        when(documentRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> documentService.findById(id))
                .isInstanceOf(DocumentNotFoundException.class);
    }
}
