package dev.emit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.ConfluentKafkaContainer;
import org.testcontainers.utility.DockerImageName;

import dev.emit.document.adapter.in.rest.CreateDocumentRequest;
import dev.emit.document.adapter.in.rest.DocumentResponse;
import dev.emit.document.domain.DocumentStatus;
import dev.emit.shared.auth.LoginRequest;
import dev.emit.shared.auth.LoginResponse;
import dev.emit.tenant.adapter.in.rest.CreateTenantRequest;
import dev.emit.tenant.adapter.in.rest.TenantCreatedResponse;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class DocumentIntegrationTest {

    @SuppressWarnings("resource")
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16")
            .withDatabaseName("emit_test")
            .withUsername("emit_user")
            .withPassword("emit_pass");

    @SuppressWarnings("resource")
    @Container
    static ConfluentKafkaContainer kafka = new ConfluentKafkaContainer(
            DockerImageName.parse("confluentinc/cp-kafka:7.6.1"));

    @SuppressWarnings("resource")
    @Container
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.kafka.bootstrap-servers", kafka::getBootstrapServers);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
        /*
         * This test's subject is the document lifecycle, and the lifecycle is
         * asynchronous, so it has to poll for the outcome. At the production
         * limit of 20 requests a minute it could poll for seven seconds before
         * the rate limiter started answering 429, which made the test pass or
         * fail on how fast Kafka and the PDF renderer happened to be on the
         * day. The rate limiter has its own tests; here it is noise.
         */
        registry.add("emit.rate-limit.requests-per-minute", () -> 1_000);
    }

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private String login() {
        ResponseEntity<LoginResponse> response = restTemplate.postForEntity(
                "/v1/auth/login",
                new LoginRequest("admin", "admin123"),
                LoginResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return response.getBody().token();
    }

    private String createTenant(String token, String schemaName) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);

        ResponseEntity<TenantCreatedResponse> response = restTemplate.exchange(
                "/v1/tenants",
                HttpMethod.POST,
                new HttpEntity<>(new CreateTenantRequest("Tenant " + schemaName, schemaName), headers),
                TenantCreatedResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return response.getBody().apiKey();
    }

    private UUID createDocument(String apiKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-Key", apiKey);

        ResponseEntity<DocumentResponse> response = restTemplate.exchange(
                "/v1/documents",
                HttpMethod.POST,
                new HttpEntity<>(new CreateDocumentRequest("Test Contract", "Contract content."), headers),
                DocumentResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return response.getBody().id();
    }

    private void requestGeneration(String apiKey, UUID documentId) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-Key", apiKey);

        ResponseEntity<Void> response = restTemplate.exchange(
                "/v1/documents/" + documentId + "/generate",
                HttpMethod.POST,
                new HttpEntity<>(headers),
                Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
    }

    private void awaitStatusDone(String apiKey, UUID documentId) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-Key", apiKey);

        Awaitility.await()
                .atMost(Duration.ofSeconds(30))
                .pollInterval(Duration.ofMillis(500))
                .untilAsserted(() -> {
                    ResponseEntity<DocumentResponse> response = restTemplate.exchange(
                            "/v1/documents/" + documentId,
                            HttpMethod.GET,
                            new HttpEntity<>(headers),
                            DocumentResponse.class);
                    /*
                     * Asserted before the body is read: any non-200 here comes
                     * back as an error document, and deserialising that into a
                     * DocumentResponse fails with a Jackson message about enum
                     * ordinals that says nothing about what went wrong.
                     */
                    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
                    assertThat(response.getBody().status()).isEqualTo(DocumentStatus.DONE);
                });
    }

    private void downloadPdf(String apiKey, UUID documentId) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-Key", apiKey);

        ResponseEntity<byte[]> response = restTemplate.exchange(
                "/v1/documents/" + documentId + "/pdf",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                byte[].class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_PDF);
        assertThat(response.getBody()).isNotEmpty();
    }

    @Test
    void fullDocumentLifecycle() {
        String token = login();
        String apiKey = createTenant(token, "test_company");
        UUID documentId = createDocument(apiKey);
        requestGeneration(apiKey, documentId);
        awaitStatusDone(apiKey, documentId);
        downloadPdf(apiKey, documentId);
    }

    /*
     * Each credential opens its own routes and nothing else. An admin token on
     * a tenant route has no tenant to resolve, so it must stop at a 403.
     */
    @Test
    void adminTokenIsRefusedOnTenantRoutes() throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(login());

        ResponseEntity<String> response = restTemplate.exchange(
                "/v1/documents", HttpMethod.GET, new HttpEntity<>(headers), String.class);

        assertForbiddenInApiShape(response);
    }

    @Test
    void tenantKeyIsRefusedOnAdminRoutes() throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-API-Key", createTenant(login(), "refused_tenant"));

        ResponseEntity<String> response = restTemplate.exchange(
                "/v1/tenants", HttpMethod.GET, new HttpEntity<>(headers), String.class);

        assertForbiddenInApiShape(response);
    }

    /*
     * The API's shape is `status`, `message`, `timestamp`. Spring's default
     * error document carries `error` and `path`, so their absence tells the
     * two apart.
     */
    private void assertForbiddenInApiShape(ResponseEntity<String> response) throws Exception {
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        JsonNode body = objectMapper.readTree(response.getBody());
        assertThat(body.path("status").asInt()).isEqualTo(403);
        assertThat(body.path("message").asText()).isNotBlank();
        assertThat(body.has("error")).isFalse();
        assertThat(body.has("path")).isFalse();
    }
}
