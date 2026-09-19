package dev.emit.shared.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import dev.emit.shared.security.JwtService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication")
public class AuthController {

    private final JwtService jwtService;

    @Value("${emit.admin.username}")
    private String adminUsername;

    @Value("${emit.admin.password}")
    private String adminPassword;

    @PostMapping("/login")
    @SecurityRequirements({})
    @Operation(
            summary = "Login",
            description = "Authenticates with admin credentials and returns a signed JWT. Use the token on all tenant management endpoints.")
    @ApiResponse(responseCode = "200", description = "JWT token returned")
    @ApiResponse(responseCode = "401", description = "Invalid credentials", content = @Content)
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        boolean usernameMatch = MessageDigest.isEqual(
                adminUsername.getBytes(StandardCharsets.UTF_8), request.username().getBytes(StandardCharsets.UTF_8));
        boolean passwordMatch = MessageDigest.isEqual(
                adminPassword.getBytes(StandardCharsets.UTF_8), request.password().getBytes(StandardCharsets.UTF_8));

        if (!usernameMatch || !passwordMatch) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String token = jwtService.generateToken(request.username());
        return ResponseEntity.ok(new LoginResponse(token));
    }
}
