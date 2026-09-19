package dev.emit.document.adapter.in.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import java.util.UUID;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import dev.emit.document.application.PdfGenerationService;
import dev.emit.document.domain.DocumentGenerationRequestedEvent;
import dev.emit.shared.multitenancy.TenantContext;
import dev.emit.shared.multitenancy.TenantContextDecorator;

@ExtendWith(MockitoExtension.class)
class DocumentGenerationConsumerTest {

    @Mock
    private PdfGenerationService pdfGenerationService;

    private DocumentGenerationConsumer consumer;

    @BeforeEach
    void setUp() {
        consumer = new DocumentGenerationConsumer(pdfGenerationService, new TenantContextDecorator());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private ConsumerRecord<String, DocumentGenerationRequestedEvent> buildRecord(UUID documentId, String tenantSchema) {
        DocumentGenerationRequestedEvent event = new DocumentGenerationRequestedEvent(documentId, tenantSchema);
        return new ConsumerRecord<>("document-generation", 0, 0L, documentId.toString(), event);
    }

    @Test
    void shouldCallGenerateSyncWithCorrectDocumentId() {
        UUID documentId = UUID.randomUUID();

        consumer.consume(buildRecord(documentId, "tenant_abc"));

        verify(pdfGenerationService).generateSync(documentId);
    }

    @Test
    void shouldClearTenantContextAfterSuccessfulProcessing() {
        UUID documentId = UUID.randomUUID();

        consumer.consume(buildRecord(documentId, "tenant_abc"));

        assertThat(TenantContext.getTenant()).isNull();
    }

    @Test
    void shouldClearTenantContextEvenWhenGenerateSyncThrows() {
        UUID documentId = UUID.randomUUID();
        doThrow(new RuntimeException("pdf failure")).when(pdfGenerationService).generateSync(documentId);

        assertThatThrownBy(() -> consumer.consume(buildRecord(documentId, "tenant_abc")))
                .isInstanceOf(RuntimeException.class);

        assertThat(TenantContext.getTenant()).isNull();
    }

    @Test
    void handleDltShouldAbandonGenerationAndClearContext() {
        UUID documentId = UUID.randomUUID();

        consumer.handleDlt(buildRecord(documentId, "tenant_abc"));

        verify(pdfGenerationService).abandonGeneration(documentId);
        assertThat(TenantContext.getTenant()).isNull();
    }

    @Test
    void handleDltShouldClearContextEvenWhenAbandonmentThrows() {
        UUID documentId = UUID.randomUUID();
        doThrow(new RuntimeException("db failure")).when(pdfGenerationService).abandonGeneration(documentId);

        assertThatThrownBy(() -> consumer.handleDlt(buildRecord(documentId, "tenant_abc")))
                .isInstanceOf(RuntimeException.class);

        assertThat(TenantContext.getTenant()).isNull();
    }
}
