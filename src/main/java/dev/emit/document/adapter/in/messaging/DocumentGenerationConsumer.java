package dev.emit.document.adapter.in.messaging;

import java.util.Map;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.retry.annotation.Backoff;
import org.springframework.stereotype.Component;

import dev.emit.document.application.PdfGenerationService;
import dev.emit.document.domain.DocumentGenerationRequestedEvent;
import dev.emit.shared.multitenancy.TenantContextDecorator;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
class DocumentGenerationConsumer {

    private static final Logger log = LoggerFactory.getLogger(DocumentGenerationConsumer.class);

    private final PdfGenerationService pdfGenerationService;
    private final TenantContextDecorator tenantContextDecorator;

    @RetryableTopic(attempts = "3", backoff = @Backoff(delay = 1000, multiplier = 2), dltTopicSuffix = ".dlq")
    @KafkaListener(topics = "${emit.kafka.topic.document-generation}", groupId = "${spring.kafka.consumer.group-id}")
    void consume(ConsumerRecord<String, DocumentGenerationRequestedEvent> record) {
        DocumentGenerationRequestedEvent event = record.value();
        tenantContextDecorator.run(
                event.tenantSchema(),
                Map.of("tenantSchema", event.tenantSchema(), "documentId", event.documentId().toString()),
                () -> {
                    log.info("Starting PDF generation documentId={} tenant={}", event.documentId(), event.tenantSchema());
                    pdfGenerationService.generateSync(event.documentId());
                });
    }

    @DltHandler
    void handleDlt(ConsumerRecord<String, DocumentGenerationRequestedEvent> record) {
        DocumentGenerationRequestedEvent event = record.value();
        tenantContextDecorator.run(
                event.tenantSchema(),
                Map.of("tenantSchema", event.tenantSchema(), "documentId", event.documentId().toString()),
                () -> {
                    log.error("Document generation permanently failed after retries, documentId={}", event.documentId());
                    pdfGenerationService.abandonGeneration(event.documentId());
                });
    }
}
