package dev.emit.document.adapter.out.messaging;

import java.time.Duration;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import dev.emit.document.application.DocumentEventPublisher;
import dev.emit.document.application.GenerationNotQueuedException;
import dev.emit.document.domain.DocumentGenerationRequestedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.KafkaException;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.kafka.support.SendResult;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

@Component
class KafkaDocumentEventPublisher implements DocumentEventPublisher, SmartInitializingSingleton {

    private static final Logger log = LoggerFactory.getLogger(KafkaDocumentEventPublisher.class);

    private final String topic;
    private final Duration ackTimeout;
    private final KafkaTemplate<String, DocumentGenerationRequestedEvent> kafkaTemplate;

    KafkaDocumentEventPublisher(
            @Value("${emit.kafka.topic.document-generation}") String topic,
            @Value("${emit.kafka.ack-timeout}") Duration ackTimeout,
            KafkaTemplate<String, DocumentGenerationRequestedEvent> kafkaTemplate) {
        this.topic = topic;
        this.ackTimeout = ackTimeout;
        this.kafkaTemplate = kafkaTemplate;
    }

    // The producer is created before the app serves, so its handshake with the
    // broker (its producer id, once measured at 3.4 s) happens in the background
    // instead of inside the first request's acknowledgement budget. Creating it
    // does not wait for a broker, so one that is down does not stop startup.
    @Override
    public void afterSingletonsInstantiated() {
        kafkaTemplate.getProducerFactory().createProducer().close();
    }

    // Returns only once the broker has acknowledged the event (acks=all), so the
    // 202 that follows means the request is durable. The producer's own delivery
    // timeout fails the send first; this wait is the backstop.
    @Override
    public void publishGenerationRequested(DocumentGenerationRequestedEvent event) {
        SendResult<String, DocumentGenerationRequestedEvent> result;
        try {
            result = kafkaTemplate
                    .send(MessageBuilder.withPayload(event)
                            .setHeader(KafkaHeaders.TOPIC, topic)
                            .setHeader(KafkaHeaders.KEY, event.documentId().toString())
                            .setHeader("tenantSchema", event.tenantSchema())
                            .build())
                    .get(ackTimeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new GenerationNotQueuedException(interrupted);
        } catch (ExecutionException
                | TimeoutException
                | KafkaException
                | org.apache.kafka.common.KafkaException failure) {
            log.error("Generation event not acknowledged documentId={}", event.documentId(), failure);
            throw new GenerationNotQueuedException(failure);
        }
        log.debug(
                "Published generation event documentId={} offset={}",
                event.documentId(),
                result.getRecordMetadata().offset());
    }
}
