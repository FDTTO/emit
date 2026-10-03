package dev.emit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.models.OpenAPI;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Rules the published models state about their fields, checked against
 * what the API validates.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@AutoConfigureTestRestTemplate
class ApiDocsTest extends ContainerizedTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private OpenAPI openAPI;

    @Test
    void aRequiredStringWithALengthRuleNeverAdmitsAnEmptyValue() throws Exception {
        JsonNode schemas = objectMapper
                .readTree(restTemplate.getForObject("/v3/api-docs", String.class))
                .path("components")
                .path("schemas");

        List<String> admitsEmpty = new ArrayList<>();
        schemas.properties().forEach(model -> {
            JsonNode required = model.getValue().path("required");
            model.getValue().path("properties").properties().forEach(property -> {
                JsonNode rules = property.getValue();
                boolean isRequired =
                        required.isArray() && required.toString().contains("\"" + property.getKey() + "\"");
                if (isRequired
                        && "string".equals(rules.path("type").asString())
                        && rules.has("minLength")
                        && rules.path("minLength").asInt() < 1) {
                    admitsEmpty.add(model.getKey() + "." + property.getKey());
                }
            });
        });

        assertThat(admitsEmpty).isEmpty();
    }

    /*
     * springdoc deep-copies this bean before every build with a plain Jackson 2
     * mapper, not the app's Jackson 3 one; anything that mapper cannot write is
     * dropped from the copy with only a warning in the log.
     */
    @Test
    void theBaseDescriptionCopiesWithAPlainMapper() {
        com.fasterxml.jackson.databind.ObjectMapper springdocs = new com.fasterxml.jackson.databind.ObjectMapper();
        assertThatCode(() -> springdocs.writeValueAsString(openAPI)).doesNotThrowAnyException();
    }

    @Test
    void everyErrorIsDescribedByTheErrorSchemaWithItsTimestamp() throws Exception {
        JsonNode error = objectMapper
                .readTree(restTemplate.getForObject("/v3/api-docs", String.class))
                .path("components")
                .path("schemas")
                .path("ErrorResponse");

        assertThat(error.path("properties").path("timestamp").path("example").asString())
                .isEqualTo("2026-01-15T10:30:00Z");
    }
}
