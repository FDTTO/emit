package dev.emit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Stream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Every error example in the published spec is a claim about what the API
 * answers. This makes the API answer each one and compares status and
 * message, so the documentation cannot drift from the code. An example
 * nobody here knows how to trigger fails too: a new one needs a way in.
 *
 * <p>Requests ask for Portuguese on purpose: the API answers in one
 * language, whatever the caller or the host machine prefers.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ErrorContractTest extends ContainerizedTest {

    private static final int LIMIT = 100;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("emit.rate-limit.requests-per-minute", () -> LIMIT);
    }

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private String adminToken;
    private String tenantKey;
    private String inactiveTenantKey;
    private String exhaustedTenantKey;

    private record Operation(String id, HttpMethod method, String path, String scheme) {
    }

    private record Credential(String header, String value) {
    }

    @BeforeAll
    void createCallers() throws Exception {
        adminToken = json(send(HttpMethod.POST, "/v1/auth/login", null,
                "{\"username\":\"admin\",\"password\":\"admin123\"}")).get("token").asText();
        tenantKey = createTenant("contract_main").get("apiKey").asText();

        JsonNode inactive = createTenant("contract_inactive");
        inactiveTenantKey = inactive.get("apiKey").asText();
        send(HttpMethod.POST, "/v1/tenants/" + inactive.get("id").asText() + "/deactivate", admin(), null);

        exhaustedTenantKey = createTenant("contract_exhausted").get("apiKey").asText();
        for (int i = 0; i < LIMIT; i++) {
            send(HttpMethod.GET, "/v1/documents", apiKey(exhaustedTenantKey), null);
        }
    }

    @TestFactory
    Stream<DynamicTest> everyDocumentedErrorIsWhatTheApiAnswers() throws Exception {
        JsonNode spec = json(send(HttpMethod.GET, "/v3/api-docs", null, null));
        List<DynamicTest> tests = new ArrayList<>();

        spec.get("paths").fields().forEachRemaining(path -> path.getValue().fields().forEachRemaining(entry -> {
            JsonNode node = entry.getValue();
            JsonNode security = node.path("security");
            Operation operation = new Operation(
                    node.get("operationId").asText(),
                    HttpMethod.valueOf(entry.getKey().toUpperCase()),
                    path.getKey(),
                    security.isEmpty() ? null : security.get(0).fieldNames().next());

            node.get("responses").fields().forEachRemaining(response -> {
                int status = Integer.parseInt(response.getKey());
                if (status < 400) {
                    return;
                }
                JsonNode examples = response.getValue().path("content").path("application/json").path("examples");
                if (examples.isEmpty()) {
                    tests.add(DynamicTest.dynamicTest(operation.id() + " " + status + " has named examples",
                            () -> assertThat(examples.isEmpty()).as("examples").isFalse()));
                    return;
                }
                examples.fields().forEachRemaining(example -> tests.add(DynamicTest.dynamicTest(
                        operation.id() + " " + status + " " + example.getKey(),
                        () -> assertAnswer(operation, status, example.getKey(), example.getValue().get("value")))));
            });
        }));
        return tests.stream();
    }

    private void assertAnswer(Operation operation, int status, String name, JsonNode documented) throws Exception {
        String label = operation.id() + " " + status + " " + name;
        Function<Operation, ResponseEntity<String>> trigger = triggers().get(name);
        assertThat(trigger).as("%s: a way to trigger it", label).isNotNull();

        ResponseEntity<String> actual = trigger.apply(operation);
        assertThat(actual.getStatusCode().value()).as("%s: status", label).isEqualTo(status);

        JsonNode body = json(actual);
        assertThat(body.get("status").asInt()).as("%s: status in the body", label).isEqualTo(status);
        assertThat(documented.get("status").asInt()).as("%s: status in the example", label).isEqualTo(status);
        assertThat(normalized(body.get("message").asText()))
                .as("%s: message", label)
                .isEqualTo(normalized(documented.get("message").asText()));
    }

    private Map<String, Function<Operation, ResponseEntity<String>>> triggers() {
        return Map.ofEntries(
                Map.entry("missing-credential", operation -> call(operation, null)),
                Map.entry("invalid-api-key", operation -> call(operation, new Credential("X-API-Key", "not-a-key"))),
                Map.entry("invalid-token", operation -> call(operation, new Credential(HttpHeaders.AUTHORIZATION, "Bearer not-a-token"))),
                Map.entry("wrong-credential", operation -> call(operation,
                        "apiKeyAuth".equals(operation.scheme()) ? admin() : apiKey(tenantKey))),
                Map.entry("tenant-inactive", operation -> call(operation, apiKey(inactiveTenantKey))),
                Map.entry("rate-limited", operation -> call(operation, apiKey(exhaustedTenantKey))),
                Map.entry("unknown-id", operation -> send(operation.method(),
                        withId(operation, UUID.randomUUID().toString()), valid(operation), null)),
                Map.entry("invalid-id", operation -> send(operation.method(),
                        withId(operation, "not-a-uuid"), valid(operation), null)),
                Map.entry("invalid-body", operation -> send(operation.method(), operation.path(), valid(operation), "{}")),
                Map.entry("invalid-credentials", operation -> send(operation.method(), operation.path(), null,
                        "{\"username\":\"admin\",\"password\":\"wrong\"}")),
                Map.entry("schema-taken", operation -> {
                    String body = "{\"name\":\"Taken\",\"schemaName\":\"contract_taken\"}";
                    send(operation.method(), operation.path(), admin(), body);
                    return send(operation.method(), operation.path(), admin(), body);
                }),
                Map.entry("not-pending", operation -> {
                    String id = createDocument();
                    send(HttpMethod.POST, "/v1/documents/" + id + "/generate", apiKey(tenantKey), null);
                    Awaitility.await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(500))
                            .until(() -> "DONE".equals(json(send(HttpMethod.GET, "/v1/documents/" + id,
                                    apiKey(tenantKey), null)).get("status").asText()));
                    return send(operation.method(), withId(operation, id), apiKey(tenantKey), null);
                }),
                Map.entry("pdf-not-ready", operation -> send(operation.method(), withId(operation, createDocument()),
                        apiKey(tenantKey), null)));
    }

    /*
     * Ids and counts differ from run to run (a created id, the seconds left
     * in a rate-limit window), so both sides compare with them masked.
     */
    private static String normalized(String message) {
        return message
                .replaceAll("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "{uuid}")
                .replaceAll("\\d+", "{n}");
    }

    private ResponseEntity<String> call(Operation operation, Credential credential) {
        return send(operation.method(), withId(operation, UUID.randomUUID().toString()), credential, null);
    }

    private Credential valid(Operation operation) {
        return "apiKeyAuth".equals(operation.scheme()) ? apiKey(tenantKey) : admin();
    }

    private Credential admin() {
        return new Credential(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken);
    }

    private static Credential apiKey(String key) {
        return new Credential("X-API-Key", key);
    }

    private static String withId(Operation operation, String id) {
        return operation.path().replace("{id}", id);
    }

    private JsonNode createTenant(String schemaName) throws Exception {
        return json(send(HttpMethod.POST, "/v1/tenants", admin(),
                "{\"name\":\"" + schemaName + "\",\"schemaName\":\"" + schemaName + "\"}"));
    }

    private String createDocument() {
        try {
            return json(send(HttpMethod.POST, "/v1/documents", apiKey(tenantKey),
                    "{\"title\":\"Contract\",\"content\":\"<p>Contract</p>\"}")).get("id").asText();
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private ResponseEntity<String> send(HttpMethod method, String path, Credential credential, String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.ACCEPT_LANGUAGE, "pt-BR");
        if (credential != null) {
            headers.set(credential.header(), credential.value());
        }
        if (body != null) {
            headers.setContentType(MediaType.APPLICATION_JSON);
        }
        return restTemplate.exchange(path, method, new HttpEntity<>(body, headers), String.class);
    }

    private JsonNode json(ResponseEntity<String> response) throws Exception {
        assertThat(response.getBody()).as("body of %s", response.getStatusCode()).isNotBlank();
        return objectMapper.readTree(response.getBody());
    }
}
