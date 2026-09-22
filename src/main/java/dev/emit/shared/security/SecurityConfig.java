package dev.emit.shared.security;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import dev.emit.shared.multitenancy.TenantFilter;
import dev.emit.shared.ratelimit.RateLimitFilter;
import dev.emit.shared.web.ApiErrorWriter;
import dev.emit.shared.web.RefusalMessages;
import jakarta.servlet.DispatcherType;
import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final TenantFilter tenantFilter;
    private final RateLimitFilter rateLimitFilter;
    private final ApiErrorWriter errorWriter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(auth -> auth
                .dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll()
                .requestMatchers("/v1/auth/login").permitAll()
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html", "/swagger/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                // The rest of the actuator answers to operators, not to API
                // credentials, so it stays closed to every caller here.
                .requestMatchers("/actuator/**").denyAll()
                // Admin-only: creating and managing tenants requires JWT with ROLE_ADMIN.
                // A tenant API key satisfies authenticated() but not hasRole("ADMIN").
                .requestMatchers("/v1/tenants/**").hasRole("ADMIN")
                // Tenant data needs a resolved tenant, which only a tenant API
                // key provides. An admin token here would fail later as a 500.
                .requestMatchers("/v1/documents/**").hasRole("TENANT")
                // A caller who proved who they are gets the honest answer for a
                // URL that does not exist: 404 from the dispatcher. Without a
                // credential the 401 comes first, so the set of routes cannot
                // be mapped anonymously.
                .anyRequest().authenticated())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Both refusals go through the same writer, so a 401 and a 403
                // share the API's error shape instead of Spring's default.
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint((request, response, authException) -> errorWriter.write(
                                response, 401, RefusalMessages.AUTHENTICATION_REQUIRED))
                        .accessDeniedHandler((request, response, deniedException) -> errorWriter.write(
                                response, 403, RefusalMessages.WRONG_CREDENTIAL)))
                .addFilterBefore(tenantFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(rateLimitFilter, TenantFilter.class)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // Prevent Spring Boot from auto-registering these filters directly in the
    // Tomcat servlet filter chain. They must only run inside the Spring Security
    // filter chain where ordering is controlled by SecurityFilterChain above.
    @Bean
    public FilterRegistrationBean<TenantFilter> tenantFilterRegistration(TenantFilter filter) {
        FilterRegistrationBean<TenantFilter> reg = new FilterRegistrationBean<>(filter);
        reg.setEnabled(false);
        return reg;
    }

    @Bean
    public FilterRegistrationBean<RateLimitFilter> rateLimitFilterRegistration(RateLimitFilter filter) {
        FilterRegistrationBean<RateLimitFilter> reg = new FilterRegistrationBean<>(filter);
        reg.setEnabled(false);
        return reg;
    }

    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration(JwtAuthenticationFilter filter) {
        FilterRegistrationBean<JwtAuthenticationFilter> reg = new FilterRegistrationBean<>(filter);
        reg.setEnabled(false);
        return reg;
    }
}
