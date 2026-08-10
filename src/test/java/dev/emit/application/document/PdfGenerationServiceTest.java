package dev.emit.application.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
import org.thymeleaf.TemplateEngine;

import dev.emit.domain.document.Document;
import dev.emit.domain.document.DocumentNotFoundException;
import dev.emit.domain.document.DocumentRepository;
import dev.emit.domain.document.DocumentStatus;
import dev.emit.infrastructure.pdf.PdfRenderer;

@ExtendWith(MockitoExtension.class)
class PdfGenerationServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private TemplateEngine templateEngine;

    @Mock
    private PdfRenderer pdfRenderer;

    @InjectMocks
    private PdfGenerationService pdfGenerationService;

    private Document buildDocument() {
        return Document.create("Test Document", "Test content");
    }

    @Test
    void shouldThrowWhenDocumentNotFound() {
        UUID id = UUID.randomUUID();
        when(documentRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> pdfGenerationService.generate(id))
                .isInstanceOf(DocumentNotFoundException.class);

        verify(documentRepository, never()).save(any());
    }

    @Test
    void shouldSetStatusToFailedWhenRenderingFails() {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();

        when(documentRepository.findById(id)).thenReturn(Optional.of(document));
        when(templateEngine.process(anyString(), any())).thenReturn("<html></html>");
        when(pdfRenderer.render(anyString())).thenThrow(new RuntimeException("render failed"));
        when(documentRepository.save(any())).thenReturn(document);

        assertThatThrownBy(() -> pdfGenerationService.generate(id))
                .isInstanceOf(RuntimeException.class);

        assertThat(document.getStatus()).isEqualTo(DocumentStatus.FAILED);
    }

    @Test
    void shouldReturnPdfAndSetStatusToDoneOnSuccess() {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();

        when(documentRepository.findById(id)).thenReturn(Optional.of(document));
        when(templateEngine.process(anyString(), any())).thenReturn("<html></html>");
        when(pdfRenderer.render(anyString())).thenReturn(new byte[] { 1, 2, 3 });
        when(documentRepository.save(any())).thenReturn(document);

        byte[] result = pdfGenerationService.generate(id).join();

        assertThat(result).isEqualTo(new byte[] { 1, 2, 3 });
        assertThat(document.getStatus()).isEqualTo(DocumentStatus.DONE);
    }
}
