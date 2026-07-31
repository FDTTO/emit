package dev.emit.infrastructure.openapi;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;

@Configuration
public class OpenApiConfig {

        @Value("${app.openapi.server-url:}")
        private String serverUrl;

        @Bean
        OpenAPI openAPI() {
                var api = new OpenAPI()
                                .info(new Info()
                                                .title("EMIT API")
                                                .description("""
                                                                Multi-tenant document processing engine. \
                                                                Each tenant operates in full data isolation via PostgreSQL schema separation. \
                                                                Authenticated requests trigger async PDF generation with tenant context \
                                                                propagated across thread boundaries.""")
                                                .version("v1")
                                                .contact(new Contact()
                                                                .name("Matheus Fedatto")
                                                                .url("https://github.com/FDTTO/emit"))
                                                .license(new License()
                                                                .name("MIT")
                                                                .url("https://github.com/FDTTO/emit/blob/main/LICENSE")))
                                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"))
                                .addSecurityItem(new SecurityRequirement().addList("apiKeyAuth"))
                                .components(new Components()
                                                .addSecuritySchemes("bearerAuth", new SecurityScheme()
                                                                .type(SecurityScheme.Type.HTTP)
                                                                .scheme("bearer")
                                                                .bearerFormat("JWT")
                                                                .description("JWT token obtido em POST /auth/login"))
                                                .addSecuritySchemes("apiKeyAuth", new SecurityScheme()
                                                                .type(SecurityScheme.Type.APIKEY)
                                                                .in(SecurityScheme.In.HEADER)
                                                                .name("X-API-Key")
                                                                .description("API key do tenant (retornada no cadastro)")));

                if (!serverUrl.isBlank()) {
                        api.servers(List.of(new Server().url(serverUrl)));
                }

                return api;
        }
}
