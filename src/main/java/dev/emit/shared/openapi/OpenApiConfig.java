package dev.emit.shared.openapi;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.oas.models.tags.Tag;

@Configuration
public class OpenApiConfig {

    @Value("${app.openapi.server-url:}")
    private String serverUrl;

    @Bean
    public OpenAPI openAPI() {
        var api = new OpenAPI()
                .info(new Info()
                        .title("EMIT API")
                        .description("""
                                Multi-tenant document processing engine. Each tenant operates in complete \
                                data isolation via PostgreSQL schema separation. Authenticated requests \
                                trigger async PDF generation with tenant context propagated across \
                                thread boundaries via Kafka.

                                ## Authentication

                                Two independent mechanisms, each with a distinct scope.
                                The scope column names the security scheme exactly as the
                                Authorize dialog lists it, so the two can be matched by name:

                                | Scope | Header | Grants |
                                |---|---|---|
                                | bearerAuth | `Authorization: Bearer <token>` | Create and manage tenants |
                                | apiKeyAuth | `X-API-Key: <key>` | Submit and retrieve documents |

                                ## Getting started

                                1. `POST /v1/auth/login` with admin credentials → copy the `token`
                                2. Click **Authorize** and paste the token under **bearerAuth**
                                3. `POST /v1/tenants` and copy the `apiKey` from the response *(returned exactly once)*
                                4. Click **Authorize** and paste the key under **apiKeyAuth**
                                5. `POST /v1/documents` → the document enters the async PDF pipeline""")
                        .version("v1"))
                .tags(List.of(
                        new Tag().name("Authentication").description("Admin login. Returns a JWT required for all tenant management endpoints."),
                        new Tag().name("Tenants").description("Tenant lifecycle management. Each tenant gets an isolated PostgreSQL schema and a one-time API key. Requires JWT authentication."),
                        new Tag().name("Documents").description("Document creation and PDF generation. Operations are scoped to the authenticated tenant's schema. Requires API Key authentication via the X-API-Key header.")))
                // No document-level security requirement: the two credentials are not
                // interchangeable, so each controller declares the scheme it accepts.
                .components(new Components()
                        .addSecuritySchemes("bearerAuth", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("JWT obtained from POST /v1/auth/login. Required for all /v1/tenants endpoints."))
                        .addSecuritySchemes("apiKeyAuth", new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.HEADER)
                                .name("X-API-Key")
                                .description("Tenant API key returned at registration. Displayed exactly once; store it securely. Required for all /v1/documents endpoints.")));

        if (!serverUrl.isBlank()) {
            api.servers(List.of(new Server().url(serverUrl)));
        }

        return api;
    }
}
