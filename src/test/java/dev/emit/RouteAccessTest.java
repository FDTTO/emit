package dev.emit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import dev.emit.shared.auth.LoginRequest;
import dev.emit.shared.auth.LoginResponse;

/**
 * What the API answers for a route or an id that does not exist. Without a
 * credential the answer stays 401, so the set of routes is not something an
 * anonymous caller can map; with one, a wrong URL is the caller's mistake and
 * says so.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class RouteAccessTest extends ContainerizedTest {

    @Autowired
    private TestRestTemplate restTemplate;

    private HttpEntity<Void> asAdmin() {
        ResponseEntity<LoginResponse> login = restTemplate.postForEntity(
                "/v1/auth/login", new LoginRequest("admin", "admin123"), LoginResponse.class);
        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(login.getBody().token());
        return new HttpEntity<>(headers);
    }

    private ResponseEntity<String> get(String path, HttpEntity<Void> request) {
        return restTemplate.exchange(path, HttpMethod.GET, request, String.class);
    }

    @Test
    void shouldAnswer401OnAnUnknownRouteWithoutCredentials() {
        assertThat(get("/v1/nope", null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void shouldAnswer404OnAnUnknownRouteWithCredentials() {
        ResponseEntity<String> response = get("/v1/nope", asAdmin());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).contains("\"status\":404");
    }

    @Test
    void shouldAnswer400WhenAPathIdIsNotAUuid() {
        ResponseEntity<String> response = get("/v1/tenants/not-a-uuid", asAdmin());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).contains("\"status\":400").contains("id");
    }

    @Test
    void shouldTagEvenARefusedResponseWithItsRequestId() {
        ResponseEntity<String> response = get("/v1/nope", null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getHeaders().getFirst("X-Request-Id")).matches("[0-9a-f-]{36}");
    }

    @Test
    void shouldKeepTheActuatorClosedToCredentialsThatAreNotItsOwn() {
        assertThat(get("/actuator/metrics", asAdmin()).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
