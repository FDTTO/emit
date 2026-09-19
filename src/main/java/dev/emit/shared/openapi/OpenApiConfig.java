package dev.emit.shared.openapi;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import dev.emit.shared.web.ErrorResponse;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.headers.Header;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.oas.models.tags.Tag;

@Configuration
public class OpenApiConfig {

    private static final Set<String> ANSWERED_BEFORE_THE_LIMITER = Set.of("401", "403");
    private static final String ERROR_SCHEMA = "ErrorResponse";

    @Value("${app.openapi.server-url:}")
    private String serverUrl;

    @Value("${app.openapi.server-description:}")
    private String serverDescription;

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

        // Declared rather than left to springdoc, whose generated entry is
        // labelled "Generated server url" in the Servers select.
        if (!serverUrl.isBlank()) {
            api.servers(List.of(new Server().url(serverUrl).description(serverDescription)));
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

    /*
     * Every error the API writes, from a controller or from a security
     * filter, is an ErrorResponse. Declared once here for every 4xx and 5xx
     * that states no body of its own, with an example carrying that
     * response's own status.
     */
    @Bean
    public OpenApiCustomizer errorBodies() {
        return api -> {
            Schema<?> schema = ModelConverters.getInstance()
                    .readAllAsResolvedSchema(ErrorResponse.class).schema;
            api.getComponents().addSchemas(ERROR_SCHEMA, schema);

            api.getPaths().values().forEach(path -> path.readOperations().forEach(operation -> {
                if (operation.getResponses() == null) {
                    return;
                }
                operation.getResponses().forEach((code, response) -> {
                    boolean error = code.startsWith("4") || code.startsWith("5");
                    boolean bodyless = response.getContent() == null || response.getContent().isEmpty();
                    if (error && bodyless) {
                        response.setContent(new Content().addMediaType("application/json", new MediaType()
                                .schema(new Schema<>().$ref("#/components/schemas/" + ERROR_SCHEMA))
                                .example(errorExample(Integer.parseInt(code), response.getDescription()))));
                    }
                });
            }));
        };
    }

    private static Map<String, Object> errorExample(int status, String message) {
        Map<String, Object> example = new LinkedHashMap<>();
        example.put("status", status);
        example.put("message", message);
        example.put("timestamp", "2026-01-15T10:30:00Z");
        return example;
    }

    private static Header header(String description) {
        return new Header().description(description).schema(new IntegerSchema());
    }
}
