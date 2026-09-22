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

import dev.emit.shared.openapi.ErrorCase;
import dev.emit.tenant.application.TenantService;
import io.swagger.v3.oas.annotations.Operation;
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
    @ErrorCase(status = 400, name = "invalid-body", summary = "Invalid request body",
            message = "name: must not be blank, schemaName: must not be blank")
    @ErrorCase(status = 409, name = "schema-taken", summary = "Schema name already in use",
            message = "Record already exists with the given data.")
    public ResponseEntity<TenantCreatedResponse> create(@Valid @RequestBody CreateTenantRequest request) {
        TenantService.TenantCreated result = tenantService.create(request.name(), request.schemaName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(TenantCreatedResponse.from(result.tenant(), result.apiKey()));
    }

    @GetMapping("/{id}")
    @Operation(operationId = "getTenant", summary = "Get tenant by ID")
    @ApiResponse(responseCode = "200", description = "Tenant found")
    @ErrorCase(status = 404, name = "unknown-id", summary = "Tenant not found",
            message = "Tenant not found: " + ErrorCase.EXAMPLE_ID)
    public ResponseEntity<TenantResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(TenantResponse.from(tenantService.findById(id)));
    }

    @PostMapping("/{id}/deactivate")
    @Operation(
            operationId = "deactivateTenant",
            summary = "Deactivate tenant",
            description = "Blocks API key authentication for this tenant. Existing documents and schema data are preserved.")
    @ApiResponse(responseCode = "204", description = "Tenant deactivated")
    @ErrorCase(status = 404, name = "unknown-id", summary = "Tenant not found",
            message = "Tenant not found: " + ErrorCase.EXAMPLE_ID)
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
    @ErrorCase(status = 404, name = "unknown-id", summary = "Tenant not found",
            message = "Tenant not found: " + ErrorCase.EXAMPLE_ID)
    public ResponseEntity<Void> reactivate(@PathVariable UUID id) {
        tenantService.reactivate(id);
        return ResponseEntity.noContent().build();
    }
}
