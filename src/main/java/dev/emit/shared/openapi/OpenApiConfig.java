package dev.emit.shared.openapi;

import java.util.List;
import java.util.Set;

import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.headers.Header;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.oas.models.tags.Tag;

@Configuration
public class OpenApiConfig {

    private static final Set<String> ANSWERED_BEFORE_THE_LIMITER = Set.of("401", "403");

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

    /*
     * Every operation that takes a tenant API key is rate limited, so its
     * responses carry the budget headers and its 429 also says when to retry.
     * Stated once, from each operation's own security requirement, rather than
     * repeated per endpoint where one could be forgotten. Not on 401 or 403:
     * those are answered before the limiter runs, so they carry no budget, and
     * documenting headers they never send would be a false contract.
     */
    @Bean
    public OpenApiCustomizer rateLimitHeaders() {
        return api -> api.getPaths().values().forEach(path -> path.readOperations().forEach(operation -> {
            boolean tenantScoped = operation.getSecurity() != null
                    && operation.getSecurity().stream().anyMatch(requirement -> requirement.containsKey("apiKeyAuth"));
            if (!tenantScoped || operation.getResponses() == null) {
                return;
            }
            operation.getResponses().forEach((code, response) -> {
                if (ANSWERED_BEFORE_THE_LIMITER.contains(code)) {
                    return;
                }
                response.addHeaderObject("RateLimit-Limit", header("Requests this tenant may make per rolling minute."));
                response.addHeaderObject("RateLimit-Remaining", header("Requests left in the current window after this one."));
                response.addHeaderObject("RateLimit-Reset", header("Seconds until the oldest request in the window leaves it and frees a slot."));
                if ("429".equals(code)) {
                    response.addHeaderObject("Retry-After", header("Seconds to wait before retrying."));
                }
            });
        }));
    }

    private static Header header(String description) {
        return new Header().description(description).schema(new IntegerSchema());
    }
}
