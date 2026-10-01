package dev.emit.document.adapter.out.messaging;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.TopicPartition;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.messaging.Message;

import dev.emit.document.application.GenerationNotQueuedException;
import dev.emit.document.domain.DocumentGenerationRequestedEvent;

class KafkaDocumentEventPublisherTest {

    private static final DocumentGenerationRequestedEvent EVENT =
            new DocumentGenerationRequestedEvent(UUID.randomUUID(), "tenant_abc", OffsetDateTime.now());

    @SuppressWarnings("unchecked")
    private final KafkaTemplate<String, DocumentGenerationRequestedEvent> template = mock(KafkaTemplate.class);

    private final KafkaDocumentEventPublisher publisher =
            new KafkaDocumentEventPublisher("document.generation.requested", Duration.ofMillis(200), template);

    @Test
    void shouldReturnOnceTheBrokerHasTheEvent() {
        RecordMetadata acknowledged = new RecordMetadata(new TopicPartition("document.generation.requested", 0), 0, 0, 0, 0, 0);
        when(template.send(any(Message.class)))
                .thenReturn(CompletableFuture.completedFuture(new SendResult<>(null, acknowledged)));

        assertThatCode(() -> publisher.publishGenerationRequested(EVENT)).doesNotThrowAnyException();
    }

    @Test
    void shouldRefuseWhenTheBrokerRefusesTheEvent() {
        when(template.send(any(Message.class)))
                .thenReturn(CompletableFuture.failedFuture(new IllegalStateException("broker down")));

        assertThatThrownBy(() -> publisher.publishGenerationRequested(EVENT))
                .isInstanceOf(GenerationNotQueuedException.class);
    }

    @Test
    void shouldRefuseWhenTheBrokerDoesNotAnswerInTime() {
        when(template.send(any(Message.class))).thenReturn(new CompletableFuture<>());

        assertThatThrownBy(() -> publisher.publishGenerationRequested(EVENT))
                .isInstanceOf(GenerationNotQueuedException.class);
    }
}
