package dev.emit.document.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionTemplate;

import dev.emit.document.domain.Document;
import dev.emit.document.domain.DocumentNotFoundException;
import dev.emit.document.domain.DocumentRepository;
import dev.emit.document.domain.DocumentStatus;

@ExtendWith(MockitoExtension.class)
class PdfGenerationServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private DocumentTemplateRenderer templateRenderer;

    @Mock
    private PdfRenderer pdfRenderer;

    @Mock
    private TransactionTemplate transactionTemplate;

    @InjectMocks
    private PdfGenerationService pdfGenerationService;

    @BeforeEach
    void setUp() {
        // TransactionTemplate delegates to the callback transparently in tests.
        // lenient() because abandonGeneration tests use @Transactional AOP, not transactionTemplate.
        lenient().when(transactionTemplate.execute(any())).thenAnswer(inv ->
                inv.<org.springframework.transaction.support.TransactionCallback<?>>getArgument(0)
                        .doInTransaction(null));
    }

    private Document buildDocument() {
        return Document.create("Test Document", "Test content");
    }

    @Test
    void generateSyncShouldThrowWhenDocumentNotFound() {
        UUID id = UUID.randomUUID();
        when(documentRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> pdfGenerationService.generateSync(id))
                .isInstanceOf(DocumentNotFoundException.class);

        verify(documentRepository, never()).save(any());
    }

    @Test
    void generateSyncShouldSetStatusToFailedWhenRenderingFails() {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();

        when(documentRepository.findById(id)).thenReturn(Optional.of(document));
        when(documentRepository.save(any())).thenReturn(document);
        when(templateRenderer.render(any())).thenReturn("<html></html>");
        when(pdfRenderer.render(anyString())).thenThrow(new RuntimeException("render failed"));

        assertThatThrownBy(() -> pdfGenerationService.generateSync(id))
                .isInstanceOf(PdfGenerationException.class);

        // markAsFailed is now in its own transaction - actually persisted, not rolled back
        assertThat(document.getStatus()).isEqualTo(DocumentStatus.FAILED);
        verify(documentRepository, times(2)).save(document);
    }

    @Test
    void generateSyncShouldSetStatusToDoneOnSuccess() {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();

        when(documentRepository.findById(id)).thenReturn(Optional.of(document));
        when(documentRepository.save(any())).thenReturn(document);
        when(templateRenderer.render(any())).thenReturn("<html></html>");
        when(pdfRenderer.render(anyString())).thenReturn(new byte[] { 1, 2, 3 });

        pdfGenerationService.generateSync(id);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.DONE);
        verify(documentRepository, times(2)).save(document);
    }

    @Test
    void generateSyncShouldPropagateTemplateRenderingFailureWithoutWrapping() {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();
        when(documentRepository.findById(id)).thenReturn(Optional.of(document));
        when(documentRepository.save(any())).thenReturn(document);
        when(templateRenderer.render(any())).thenThrow(new RuntimeException("template failed"));

        assertThatThrownBy(() -> pdfGenerationService.generateSync(id))
                .isInstanceOf(RuntimeException.class)
                .isNotInstanceOf(PdfGenerationException.class);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.PROCESSING);
    }

    @Test
    void generateSyncShouldSucceedOnRetryWhenDocumentAlreadyInProcessingState() {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();
        document.markAsProcessing();

        when(documentRepository.findById(id)).thenReturn(Optional.of(document));
        when(documentRepository.save(any())).thenReturn(document);
        when(templateRenderer.render(any())).thenReturn("<html></html>");
        when(pdfRenderer.render(anyString())).thenReturn(new byte[] { 1, 2, 3 });

        pdfGenerationService.generateSync(id);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.DONE);
        verify(documentRepository, times(1)).save(document);
    }

    @Test
    void generateSyncShouldThrowWhenDocumentIsInTerminalState() {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();
        document.markAsProcessing();
        document.markAsFailed();
        when(documentRepository.findById(id)).thenReturn(Optional.of(document));

        assertThatThrownBy(() -> pdfGenerationService.generateSync(id))
                .isInstanceOf(IllegalStateException.class);

        verify(documentRepository, never()).save(any());
    }

    @Test
    void abandonGenerationShouldMarkDocumentAsFailedAndSave() {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();
        when(documentRepository.findById(id)).thenReturn(Optional.of(document));
        when(documentRepository.save(any())).thenReturn(document);

        pdfGenerationService.abandonGeneration(id);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.FAILED);
        verify(documentRepository).save(document);
    }

    @Test
    void abandonGenerationShouldSkipWhenDocumentAlreadyInTerminalState() {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();
        document.markAsProcessing();
        document.markAsFailed();
        when(documentRepository.findById(id)).thenReturn(Optional.of(document));

        pdfGenerationService.abandonGeneration(id);

        verify(documentRepository, never()).save(any());
    }

    @Test
    void abandonGenerationShouldThrowWhenDocumentNotFound() {
        UUID id = UUID.randomUUID();
        when(documentRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> pdfGenerationService.abandonGeneration(id))
                .isInstanceOf(DocumentNotFoundException.class);

        verify(documentRepository, never()).save(any());
    }
}
