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

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
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

    private static final OffsetDateTime QUEUED_AT = OffsetDateTime.parse("2026-01-15T10:30:00Z");

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

        assertThatThrownBy(() -> pdfGenerationService.generateSync(id, QUEUED_AT))
                .isInstanceOf(DocumentNotFoundException.class);

        verify(documentRepository, never()).save(any());
    }

    @Test
    void generateSyncShouldLeaveTheDocumentProcessingWhenRenderingFails() {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();

        when(documentRepository.findById(id)).thenReturn(Optional.of(document));
        when(documentRepository.save(any())).thenReturn(document);
        when(templateRenderer.render(any())).thenReturn("<html></html>");
        when(pdfRenderer.render(anyString())).thenThrow(new RuntimeException("render failed"));

        assertThatThrownBy(() -> pdfGenerationService.generateSync(id, QUEUED_AT))
                .isInstanceOf(PdfGenerationException.class);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.PROCESSING);
        verify(documentRepository, times(1)).save(document);
    }

    @Test
    void generateSyncShouldSetStatusToDoneOnSuccess() {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();

        when(documentRepository.findById(id)).thenReturn(Optional.of(document));
        when(documentRepository.save(any())).thenReturn(document);
        when(templateRenderer.render(any())).thenReturn("<html></html>");
        when(pdfRenderer.render(anyString())).thenReturn(new byte[] { 1, 2, 3 });

        pdfGenerationService.generateSync(id, QUEUED_AT);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.DONE);
        assertThat(document.getQueuedAt()).isEqualTo(QUEUED_AT);
        assertThat(document.getFinishedAt()).isAfterOrEqualTo(document.getStartedAt());
        verify(documentRepository, times(2)).save(document);
    }

    @Test
    void generateSyncShouldPropagateTemplateRenderingFailureWithoutWrapping() {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();
        when(documentRepository.findById(id)).thenReturn(Optional.of(document));
        when(documentRepository.save(any())).thenReturn(document);
        when(templateRenderer.render(any())).thenThrow(new RuntimeException("template failed"));

        assertThatThrownBy(() -> pdfGenerationService.generateSync(id, QUEUED_AT))
                .isInstanceOf(RuntimeException.class)
                .isNotInstanceOf(PdfGenerationException.class);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.PROCESSING);
    }

    @Test
    void generateSyncShouldSucceedOnRetryWhenDocumentAlreadyInProcessingState() {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();
        document.markAsProcessing(QUEUED_AT);
        OffsetDateTime firstStart = document.getStartedAt();

        when(documentRepository.findById(id)).thenReturn(Optional.of(document));
        when(documentRepository.save(any())).thenReturn(document);
        when(templateRenderer.render(any())).thenReturn("<html></html>");
        when(pdfRenderer.render(anyString())).thenReturn(new byte[] { 1, 2, 3 });

        pdfGenerationService.generateSync(id, QUEUED_AT.plusSeconds(3));

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.DONE);
        assertThat(document.getQueuedAt()).isEqualTo(QUEUED_AT);
        assertThat(document.getStartedAt()).isEqualTo(firstStart);
        verify(documentRepository, times(1)).save(document);
    }

    @Test
    void generateSyncShouldRenderAgainOnTheRetryAfterARenderFailure() {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();

        when(documentRepository.findById(id)).thenReturn(Optional.of(document));
        when(documentRepository.save(any())).thenReturn(document);
        when(templateRenderer.render(any())).thenReturn("<html></html>");
        when(pdfRenderer.render(anyString()))
                .thenThrow(new RuntimeException("render failed"))
                .thenReturn(new byte[] { 1, 2, 3 });

        assertThatThrownBy(() -> pdfGenerationService.generateSync(id, QUEUED_AT))
                .isInstanceOf(PdfGenerationException.class);
        pdfGenerationService.generateSync(id, QUEUED_AT);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.DONE);
    }

    @ParameterizedTest
    @EnumSource(value = DocumentStatus.class, names = { "DONE", "FAILED" })
    void generateSyncShouldSkipARequestForAFinishedDocument(DocumentStatus finished) {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();
        document.markAsProcessing(QUEUED_AT);
        if (finished == DocumentStatus.DONE) {
            document.markAsDone(new byte[] { 1 });
        } else {
            document.markAsFailed();
        }
        when(documentRepository.findById(id)).thenReturn(Optional.of(document));

        pdfGenerationService.generateSync(id, QUEUED_AT);

        assertThat(document.getStatus()).isEqualTo(finished);
        verify(documentRepository, never()).save(any());
        verify(pdfRenderer, never()).render(anyString());
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
        document.markAsProcessing(QUEUED_AT);
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
