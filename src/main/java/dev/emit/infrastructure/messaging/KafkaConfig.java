package dev.emit.infrastructure.messaging;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {

    @Bean
    NewTopic documentGenerationTopic() {
        return TopicBuilder.name(DocumentEventPublisher.TOPIC)
                .partitions(3)
                .replicas(1)
                .build();
    }
}
