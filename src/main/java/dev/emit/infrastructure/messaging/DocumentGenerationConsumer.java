package dev.emit.infrastructure.messaging;

import java.util.UUID;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.retry.annotation.Backoff;
import org.springframework.stereotype.Component;

import dev.emit.application.document.PdfGenerationService;
import dev.emit.domain.document.DocumentGenerationRequestedEvent;
import dev.emit.infrastructure.multitenancy.TenantContext;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class DocumentGenerationConsumer {

    private static final Logger log = LoggerFactory.getLogger(DocumentGenerationConsumer.class);

    private final PdfGenerationService pdfGenerationService;

    @RetryableTopic(attempts = "3", backoff = @Backoff(delay = 1000, multiplier = 2), dltTopicSuffix = ".dlq")
    @KafkaListener(topics = DocumentEventPublisher.TOPIC, groupId = "emit-pdf-processor")
    public void consume(ConsumerRecord<String, DocumentGenerationRequestedEvent> record) {
        DocumentGenerationRequestedEvent event = record.value();
        TenantContext.setTenant(event.tenantSchema());
        try {
            pdfGenerationService.generateSync(event.documentId());
        } finally {
            TenantContext.clear();
        }
    }

    @DltHandler
    public void handleDlt(ConsumerRecord<String, DocumentGenerationRequestedEvent> record) {
        UUID documentId = record.value().documentId();
        log.error("Document generation permanently failed after retries, documentId={}", documentId);
    }
}
