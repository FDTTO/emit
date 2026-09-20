package dev.emit;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.kafka.ConfluentKafkaContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * The real PostgreSQL, Kafka and Redis every test that boots the application
 * runs against.
 *
 * <p>The containers are started once for the JVM rather than per class, so a
 * second test class reuses them instead of paying another startup; Ryuk stops
 * them when the JVM exits.
 */
abstract class ContainerizedTest {

    @SuppressWarnings("resource")
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16")
            .withDatabaseName("emit_test")
            .withUsername("emit_user")
            .withPassword("emit_pass");

    @SuppressWarnings("resource")
    static final ConfluentKafkaContainer KAFKA = new ConfluentKafkaContainer(
            DockerImageName.parse("confluentinc/cp-kafka:7.6.1"));

    @SuppressWarnings("resource")
    static final GenericContainer<?> REDIS = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    static {
        POSTGRES.start();
        KAFKA.start();
        REDIS.start();
    }

    @DynamicPropertySource
    static void containerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.kafka.bootstrap-servers", KAFKA::getBootstrapServers);
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    }
}
