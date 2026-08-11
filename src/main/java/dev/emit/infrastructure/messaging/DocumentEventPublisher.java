package dev.emit.infrastructure.messaging;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

import dev.emit.domain.document.DocumentGenerationRequestedEvent;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class DocumentEventPublisher {

    static final String TOPIC = "document.generation.requested";

    private final KafkaTemplate<String, DocumentGenerationRequestedEvent> kafkaTemplate;

    public void publishGenerationRequested(DocumentGenerationRequestedEvent event) {
        kafkaTemplate.send(MessageBuilder
                .withPayload(event)
                .setHeader(KafkaHeaders.TOPIC, TOPIC)
                .setHeader(KafkaHeaders.KEY, event.documentId().toString())
                .setHeader("tenantSchema", event.tenantSchema())
                .build());
    }
}
