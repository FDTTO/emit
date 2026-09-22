package dev.emit.shared.security;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import dev.emit.shared.web.ApiErrorWriter;
import dev.emit.shared.web.RefusalMessages;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final ApiErrorWriter errorWriter;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);

            if (!jwtService.isValid(token)) {
                errorWriter.write(response, HttpServletResponse.SC_UNAUTHORIZED, RefusalMessages.INVALID_TOKEN);
                return;
            }

            String subject = jwtService.extractSubject(token);
            // Adds to whatever the tenant filter, which runs first, already
            // granted: a request carrying both credentials holds both roles,
            // rather than the token silently replacing the tenant key.
            List<GrantedAuthority> authorities = new ArrayList<>();
            authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
            Authentication existing = SecurityContextHolder.getContext().getAuthentication();
            if (existing != null) {
                authorities.addAll(existing.getAuthorities());
            }
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(subject, null, authorities));
            MDC.put("adminUser", subject);
        }

        filterChain.doFilter(request, response);
    }
}
