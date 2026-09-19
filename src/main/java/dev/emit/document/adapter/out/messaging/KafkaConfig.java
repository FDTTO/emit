package dev.emit.document.adapter.out.messaging;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {

    @Value("${emit.kafka.topic.document-generation}")
    private String documentGenerationTopic;

    @Value("${emit.kafka.topic.replicas:1}")
    private int topicReplicas;

    @Bean
    public NewTopic documentGenerationTopic() {
        return TopicBuilder.name(documentGenerationTopic)
                .partitions(3)
                .replicas(topicReplicas)
                .build();
    }
}
