package dev.emit.shared.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService("test-secret-minimum-32-characters-long-ok!", 3600000L);
    }

    @Test
    void generatedTokenShouldBeValidAndContainSubject() {
        String token = jwtService.generateToken("admin");

        assertThat(jwtService.isValid(token)).isTrue();
        assertThat(jwtService.extractSubject(token)).isEqualTo("admin");
    }

    @Test
    void isValidShouldReturnFalseForTamperedToken() {
        String token = jwtService.generateToken("admin");
        String tampered = token.substring(0, token.length() - 4) + "XXXX";

        assertThat(jwtService.isValid(tampered)).isFalse();
    }

    @Test
    void isValidShouldReturnFalseForExpiredToken() {
        JwtService shortLivedService = new JwtService("test-secret-minimum-32-characters-long-ok!", -1L);
        String token = shortLivedService.generateToken("admin");

        // -1 ms: expired the moment it is issued, so nothing waits on the clock.
        assertThat(shortLivedService.isValid(token)).isFalse();
    }

    @Test
    void isValidShouldReturnFalseForGarbage() {
        assertThat(jwtService.isValid("not.a.token")).isFalse();
    }
}
