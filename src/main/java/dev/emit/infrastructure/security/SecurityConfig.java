package dev.emit.infrastructure.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import dev.emit.infrastructure.multitenancy.TenantFilter;
import dev.emit.infrastructure.ratelimit.RateLimitFilter;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

        private final JwtAuthenticationFilter jwtAuthenticationFilter;
        private final TenantFilter tenantFilter;
        private final RateLimitFilter rateLimitFilter;

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                http.authorizeHttpRequests(auth -> auth
                                .dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll()
                                .requestMatchers("/auth/login").permitAll()
                                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()
                                .requestMatchers("/v1/tenants/**").authenticated()
                                .requestMatchers("/v1/documents/**").authenticated()
                                .anyRequest().permitAll()).csrf(csrf -> csrf.disable())
                                .sessionManagement(session -> session.sessionCreationPolicy(
                                                SessionCreationPolicy.STATELESS))
                                .exceptionHandling(exception -> exception.authenticationEntryPoint((
                                                request, response,
                                                authException) -> response.sendError(
                                                                HttpServletResponse.SC_UNAUTHORIZED)))
                                .addFilterBefore(tenantFilter, UsernamePasswordAuthenticationFilter.class)
                                .addFilterAfter(rateLimitFilter, TenantFilter.class)
                                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

                return http.build();
        }
}
