package dev.emit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * Rules the published models state about their fields, checked against
 * what the API validates.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ApiDocsTest extends ContainerizedTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void aRequiredStringWithALengthRuleNeverAdmitsAnEmptyValue() throws Exception {
        JsonNode schemas = objectMapper.readTree(restTemplate.getForObject("/v3/api-docs", String.class))
                .path("components").path("schemas");

        List<String> admitsEmpty = new ArrayList<>();
        schemas.fields().forEachRemaining(model -> {
            JsonNode required = model.getValue().path("required");
            model.getValue().path("properties").fields().forEachRemaining(property -> {
                JsonNode rules = property.getValue();
                boolean isRequired = required.isArray() && required.toString().contains("\"" + property.getKey() + "\"");
                if (isRequired && "string".equals(rules.path("type").asText())
                        && rules.has("minLength") && rules.path("minLength").asInt() < 1) {
                    admitsEmpty.add(model.getKey() + "." + property.getKey());
                }
            });
        });

        assertThat(admitsEmpty).isEmpty();
    }
}
