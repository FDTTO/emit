package dev.emit.presentation.rest.tenant;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityFilterAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;

import dev.emit.application.tenant.TenantService;
import dev.emit.domain.tenant.Tenant;
import dev.emit.domain.tenant.TenantNotFoundException;
import dev.emit.domain.tenant.TenantRepository;
import dev.emit.infrastructure.ratelimit.RateLimiterService;
import dev.emit.infrastructure.security.JwtService;

@WebMvcTest(value = TenantController.class, excludeAutoConfiguration = { SecurityAutoConfiguration.class,
                SecurityFilterAutoConfiguration.class })
class TenantControllerTest {

        @Autowired
        private MockMvc mockMvc;

        @Autowired
        private ObjectMapper objectMapper;

        @MockitoBean
        private TenantService tenantService;

        @MockitoBean
        private JwtService jwtService;

        @MockitoBean
        private TenantRepository tenantRepository;

        @MockitoBean
        private RateLimiterService rateLimiterService;

        private Tenant buildTenant() {
                Tenant tenant = new Tenant();
                tenant.setId(UUID.randomUUID());
                tenant.setName("Acme Corp");
                tenant.setSchemaName("acme_corp");
                tenant.setActive(true);
                tenant.setCreatedAt(OffsetDateTime.now());
                return tenant;
        }

        @Test
        void shouldReturnCreatedTenantWithApiKey() throws Exception {
                Tenant tenant = buildTenant();
                when(tenantService.create(anyString(), anyString()))
                                .thenReturn(new TenantService.TenantCreated(tenant, "generated-api-key"));

                String body = objectMapper.writeValueAsString(
                                new CreateTenantRequest("Acme Corp", "acme_corp"));

                mockMvc.perform(post("/v1/tenants")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.name").value("Acme Corp"))
                                .andExpect(jsonPath("$.schemaName").value("acme_corp"))
                                .andExpect(jsonPath("$.apiKey").value("generated-api-key"));
        }

        @Test
        void shouldReturn400WhenSchemaNameStartsWithDigit() throws Exception {
                String body = objectMapper.writeValueAsString(
                                new CreateTenantRequest("Acme Corp", "1invalid"));

                mockMvc.perform(post("/v1/tenants")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                                .andExpect(status().isBadRequest());
        }

        @Test
        void shouldReturn400WhenSchemaNameHasUppercase() throws Exception {
                String body = objectMapper.writeValueAsString(
                                new CreateTenantRequest("Acme Corp", "AcmeCorp"));

                mockMvc.perform(post("/v1/tenants")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                                .andExpect(status().isBadRequest());
        }

        @Test
        void shouldReturn400WhenSchemaNameHasHyphen() throws Exception {
                String body = objectMapper.writeValueAsString(
                                new CreateTenantRequest("Acme Corp", "acme-corp"));

                mockMvc.perform(post("/v1/tenants")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                                .andExpect(status().isBadRequest());
        }

        @Test
        void shouldReturn400WhenSchemaNameIsTooShort() throws Exception {
                String body = objectMapper.writeValueAsString(
                                new CreateTenantRequest("Acme Corp", "a"));

                mockMvc.perform(post("/v1/tenants")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                                .andExpect(status().isBadRequest());
        }

        @Test
        void shouldReturn400WhenNameIsBlank() throws Exception {
                String body = objectMapper.writeValueAsString(
                                new CreateTenantRequest("", "acme_corp"));

                mockMvc.perform(post("/v1/tenants")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                                .andExpect(status().isBadRequest());
        }

        @Test
        void shouldReturn404WhenTenantNotFound() throws Exception {
                UUID id = UUID.randomUUID();
                when(tenantService.findById(id)).thenThrow(new TenantNotFoundException(id));

                mockMvc.perform(get("/v1/tenants/" + id))
                                .andExpect(status().isNotFound());
        }

        @Test
        void shouldReturnListOfTenants() throws Exception {
                when(tenantService.listAll()).thenReturn(List.of(buildTenant()));

                mockMvc.perform(get("/v1/tenants"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$[0].name").value("Acme Corp"))
                                .andExpect(jsonPath("$[0].schemaName").value("acme_corp"));
        }

        @Test
        void shouldReturn204WhenTenantDeactivated() throws Exception {
                UUID id = UUID.randomUUID();
                doNothing().when(tenantService).deactivate(id);

                mockMvc.perform(post("/v1/tenants/" + id + "/deactivate"))
                                .andExpect(status().isNoContent());
        }

        @Test
        void shouldReturn404WhenDeactivatingNonExistentTenant() throws Exception {
                UUID id = UUID.randomUUID();
                doThrow(new TenantNotFoundException(id)).when(tenantService).deactivate(id);

                mockMvc.perform(post("/v1/tenants/" + id + "/deactivate"))
                                .andExpect(status().isNotFound());
        }

        @Test
        void shouldReturn204WhenTenantReactivated() throws Exception {
                UUID id = UUID.randomUUID();
                doNothing().when(tenantService).reactivate(id);

                mockMvc.perform(post("/v1/tenants/" + id + "/reactivate"))
                                .andExpect(status().isNoContent());
        }

        @Test
        void shouldReturn404WhenReactivatingNonExistentTenant() throws Exception {
                UUID id = UUID.randomUUID();
                doThrow(new TenantNotFoundException(id)).when(tenantService).reactivate(id);

                mockMvc.perform(post("/v1/tenants/" + id + "/reactivate"))
                                .andExpect(status().isNotFound());
        }
}
