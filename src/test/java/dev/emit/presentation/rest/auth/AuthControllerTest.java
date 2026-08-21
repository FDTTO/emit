package dev.emit.presentation.rest.auth;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityFilterAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;

import dev.emit.domain.tenant.TenantRepository;
import dev.emit.infrastructure.ratelimit.RateLimiterService;
import dev.emit.infrastructure.security.JwtService;

@WebMvcTest(value = AuthController.class, excludeAutoConfiguration = { SecurityAutoConfiguration.class,
        SecurityFilterAutoConfiguration.class })
@TestPropertySource(properties = { "emit.admin.username=admin", "emit.admin.password=secret" })
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private TenantRepository tenantRepository;

    @MockitoBean
    private RateLimiterService rateLimiterService;

    @Test
    void shouldReturn200AndTokenWhenCredentialsAreValid() throws Exception {
        when(jwtService.generateToken(anyString())).thenReturn("generated-token");

        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest("admin", "secret"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("generated-token"));
    }

    @Test
    void shouldReturn401WhenPasswordIsWrong() throws Exception {
        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest("admin", "wrong"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldReturn401WhenUsernameIsWrong() throws Exception {
        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest("other", "secret"))))
                .andExpect(status().isUnauthorized());
    }
}
