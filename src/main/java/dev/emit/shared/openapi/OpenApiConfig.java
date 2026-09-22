package dev.emit.shared.openapi;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.MethodParameter;
import org.springframework.core.ParameterNameDiscoverer;
import org.springframework.web.bind.annotation.PathVariable;

import dev.emit.shared.web.ErrorResponse;
import dev.emit.shared.web.RefusalMessages;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.examples.Example;
import io.swagger.v3.oas.models.headers.Header;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.oas.models.tags.Tag;

@Configuration
public class OpenApiConfig {

    private static final Set<String> ANSWERED_BEFORE_THE_LIMITER = Set.of("401", "403");
    private static final String ERROR_SCHEMA = "ErrorResponse";
    private static final String EXAMPLE_TIMESTAMP = "2026-01-15T10:30:00Z";
    private static final ParameterNameDiscoverer PARAMETER_NAMES = new DefaultParameterNameDiscoverer();

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
                        .addSchemas(ERROR_SCHEMA, ModelConverters.getInstance()
                                .readAllAsResolvedSchema(ErrorResponse.class).schema)
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
     * Every error the API writes is an ErrorResponse, published with one
     * named example per way the operation can fail, quoting the message the
     * API writes. Refusals follow from the route's security scheme and use
     * the filters' own messages; a malformed id follows from a UUID path
     * variable; the rest is what the operation declares with @ErrorCase.
     */
    @Bean
    public OperationCustomizer errorResponses() {
        return (operation, handlerMethod) -> {
            List<Case> cases = new ArrayList<>(refusals(operation));
            for (MethodParameter parameter : handlerMethod.getMethodParameters()) {
                parameter.initParameterNameDiscovery(PARAMETER_NAMES);
                PathVariable variable = parameter.getParameterAnnotation(PathVariable.class);
                if (variable != null && parameter.getParameterType() == UUID.class) {
                    String name = variable.value().isEmpty() ? parameter.getParameterName() : variable.value();
                    cases.add(new Case(400, "invalid-id", "Malformed id", "'" + name + "' is not a valid UUID."));
                }
            }
            for (ErrorCase declared : handlerMethod.getMethod().getAnnotationsByType(ErrorCase.class)) {
                cases.add(new Case(declared.status(), declared.name(), declared.summary(), declared.message()));
            }

            Map<Integer, List<Case>> byStatus = new TreeMap<>();
            cases.forEach(each -> byStatus.computeIfAbsent(each.status(), status -> new ArrayList<>()).add(each));
            byStatus.forEach((status, group) -> operation.getResponses().addApiResponse(String.valueOf(status),
                    errorResponse(group)));

            ApiResponses sorted = new ApiResponses();
            new TreeMap<>(operation.getResponses()).forEach(sorted::addApiResponse);
            return operation.responses(sorted);
        };
    }

    private record Case(int status, String name, String summary, String message) {
    }

    private static List<Case> refusals(io.swagger.v3.oas.models.Operation operation) {
        List<SecurityRequirement> security = operation.getSecurity();
        if (security == null || security.isEmpty()) {
            return List.of();
        }
        Case missing = new Case(401, "missing-credential", "No credential", RefusalMessages.AUTHENTICATION_REQUIRED);
        Case wrong = new Case(403, "wrong-credential", "Credential for the other scope", RefusalMessages.WRONG_CREDENTIAL);
        if (security.get(0).containsKey("apiKeyAuth")) {
            return List.of(missing,
                    new Case(401, "invalid-api-key", "Unknown API key", RefusalMessages.INVALID_API_KEY),
                    wrong,
                    new Case(403, "tenant-inactive", "Tenant deactivated", RefusalMessages.TENANT_INACTIVE),
                    new Case(429, "rate-limited", "Rate limit exceeded", RefusalMessages.rateLimited(12)));
        }
        return List.of(missing,
                new Case(401, "invalid-token", "Rejected token", RefusalMessages.INVALID_TOKEN),
                wrong);
    }

    private static ApiResponse errorResponse(List<Case> group) {
        MediaType body = new MediaType().schema(new Schema<>().$ref("#/components/schemas/" + ERROR_SCHEMA));
        group.forEach(each -> body.addExamples(each.name(), new Example()
                .summary(each.summary())
                .value(errorExample(each))));
        return new ApiResponse()
                .description(describe(group))
                .content(new Content().addMediaType("application/json", body));
    }

    /* "No credential or unknown API key": the first summary as written, the rest lower-cased. */
    private static String describe(List<Case> group) {
        return group.get(0).summary() + group.stream().skip(1)
                .map(each -> " or " + Character.toLowerCase(each.summary().charAt(0)) + each.summary().substring(1))
                .collect(Collectors.joining());
    }

    private static Map<String, Object> errorExample(Case error) {
        Map<String, Object> example = new LinkedHashMap<>();
        example.put("status", error.status());
        example.put("message", error.message());
        example.put("timestamp", EXAMPLE_TIMESTAMP);
        return example;
    }

    private static Header header(String description) {
        return new Header().description(description).schema(new IntegerSchema());
    }
}
