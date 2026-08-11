package dev.emit.infrastructure.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import java.util.UUID;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import dev.emit.application.document.PdfGenerationService;
import dev.emit.domain.document.DocumentGenerationRequestedEvent;
import dev.emit.infrastructure.multitenancy.TenantContext;

@ExtendWith(MockitoExtension.class)
class DocumentGenerationConsumerTest {

    @Mock
    private PdfGenerationService pdfGenerationService;

    @InjectMocks
    private DocumentGenerationConsumer consumer;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private ConsumerRecord<String, DocumentGenerationRequestedEvent> buildRecord(UUID documentId, String tenantSchema) {
        DocumentGenerationRequestedEvent event = new DocumentGenerationRequestedEvent(documentId, tenantSchema);
        return new ConsumerRecord<>(DocumentEventPublisher.TOPIC, 0, 0L, documentId.toString(), event);
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
}
