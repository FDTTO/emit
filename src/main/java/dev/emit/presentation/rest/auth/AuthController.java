package dev.emit.presentation.rest.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import dev.emit.infrastructure.security.JwtService;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final JwtService jwtService;

    @Value("${emit.admin.username}")
    private String adminUsername;

    @Value("${emit.admin.password}")
    private String adminPassword;

    @PostMapping("/login")
    @SecurityRequirements({})
    @ApiResponse(responseCode = "200", description = "JWT token generated successfully")
    @ApiResponse(responseCode = "401", description = "Invalid credentials", content = @Content)
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        if (!request.username().equals(adminUsername) || !request.password().equals(adminPassword)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String token = jwtService.generateToken(request.username());
        return ResponseEntity.ok(new LoginResponse(token));
    }
}
