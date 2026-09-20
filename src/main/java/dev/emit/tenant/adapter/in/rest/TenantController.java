package dev.emit.tenant.adapter.in.rest;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import dev.emit.tenant.application.TenantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/v1/tenants")
@RequiredArgsConstructor
@Tag(name = "Tenants")
// Admin only: SecurityConfig gates this path on ROLE_ADMIN, which only a JWT
// carries. A tenant API key authenticates but is never granted that role.
@SecurityRequirement(name = "bearerAuth")
public class TenantController {

    private final TenantService tenantService;

    @GetMapping
    @Operation(operationId = "listTenants", summary = "List tenants", description = "Returns all tenants. Requires JWT authentication.")
    @ApiResponse(responseCode = "200", description = "Tenant list returned")
    @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content)
    @ApiResponse(responseCode = "403", description = "Wrong credential for this route", content = @Content)
    public ResponseEntity<List<TenantResponse>> listAll() {
        List<TenantResponse> tenants = tenantService.listAll()
                .stream()
                .map(TenantResponse::from)
                .toList();
        return ResponseEntity.ok(tenants);
    }

    @PostMapping
    @Operation(
            operationId = "createTenant",
            summary = "Create tenant",
            description = "Creates a tenant with an isolated PostgreSQL schema provisioned and migrated via Liquibase. "
                    + "Returns a raw API key in the `apiKey` field exactly once; it cannot be recovered after this response.")
    @ApiResponse(responseCode = "201", description = "Tenant created. The `apiKey` field is returned exactly once.")
    @ApiResponse(responseCode = "400", description = "Invalid request body", content = @Content)
    @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content)
    @ApiResponse(responseCode = "403", description = "Wrong credential for this route", content = @Content)
    @ApiResponse(responseCode = "409", description = "Schema name already in use", content = @Content)
    public ResponseEntity<TenantCreatedResponse> create(@Valid @RequestBody CreateTenantRequest request) {
        TenantService.TenantCreated result = tenantService.create(request.name(), request.schemaName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(TenantCreatedResponse.from(result.tenant(), result.apiKey()));
    }

    @GetMapping("/{id}")
    @Operation(operationId = "getTenant", summary = "Get tenant by ID")
    @ApiResponse(responseCode = "200", description = "Tenant found")
    @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content)
    @ApiResponse(responseCode = "403", description = "Wrong credential for this route", content = @Content)
    @ApiResponse(responseCode = "404", description = "Tenant not found", content = @Content)
    public ResponseEntity<TenantResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(TenantResponse.from(tenantService.findById(id)));
    }

    @PostMapping("/{id}/deactivate")
    @Operation(
            operationId = "deactivateTenant",
            summary = "Deactivate tenant",
            description = "Blocks API key authentication for this tenant. Existing documents and schema data are preserved.")
    @ApiResponse(responseCode = "204", description = "Tenant deactivated")
    @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content)
    @ApiResponse(responseCode = "403", description = "Wrong credential for this route", content = @Content)
    @ApiResponse(responseCode = "404", description = "Tenant not found", content = @Content)
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        tenantService.deactivate(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reactivate")
    @Operation(
            operationId = "reactivateTenant",
            summary = "Reactivate tenant",
            description = "Re-enables API key authentication for a previously deactivated tenant.")
    @ApiResponse(responseCode = "204", description = "Tenant reactivated")
    @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content)
    @ApiResponse(responseCode = "403", description = "Wrong credential for this route", content = @Content)
    @ApiResponse(responseCode = "404", description = "Tenant not found", content = @Content)
    public ResponseEntity<Void> reactivate(@PathVariable UUID id) {
        tenantService.reactivate(id);
        return ResponseEntity.noContent().build();
    }
}
