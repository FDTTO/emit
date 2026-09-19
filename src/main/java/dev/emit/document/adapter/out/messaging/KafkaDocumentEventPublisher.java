package dev.emit.document.adapter.out.messaging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

import dev.emit.document.application.DocumentEventPublisher;
import dev.emit.document.domain.DocumentGenerationRequestedEvent;

@Component
class KafkaDocumentEventPublisher implements DocumentEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(KafkaDocumentEventPublisher.class);

    private final String topic;
    private final KafkaTemplate<String, DocumentGenerationRequestedEvent> kafkaTemplate;

    KafkaDocumentEventPublisher(
            @Value("${emit.kafka.topic.document-generation}") String topic,
            KafkaTemplate<String, DocumentGenerationRequestedEvent> kafkaTemplate) {
        this.topic = topic;
        this.kafkaTemplate = kafkaTemplate;
    }

    @Override
    public void publishGenerationRequested(DocumentGenerationRequestedEvent event) {
        kafkaTemplate.send(MessageBuilder
                .withPayload(event)
                .setHeader(KafkaHeaders.TOPIC, topic)
                .setHeader(KafkaHeaders.KEY, event.documentId().toString())
                .setHeader("tenantSchema", event.tenantSchema())
                .build())
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish generation event documentId={}", event.documentId(), ex);
                    } else {
                        log.debug("Published generation event documentId={} offset={}",
                                event.documentId(), result.getRecordMetadata().offset());
                    }
                });
    }
}
