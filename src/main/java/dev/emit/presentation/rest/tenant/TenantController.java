package dev.emit.presentation.rest.tenant;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import dev.emit.application.tenant.TenantService;
import dev.emit.domain.tenant.Tenant;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/v1/tenants")
@RequiredArgsConstructor
public class TenantController {

    private final TenantService tenantService;

    @GetMapping
    public ResponseEntity<List<TenantResponse>> listAll() {
        List<TenantResponse> tenants = tenantService.listAll()
                .stream()
                .map(TenantResponse::from)
                .toList();
        return ResponseEntity.ok(tenants);
    }

    @PostMapping
    public ResponseEntity<TenantCreatedResponse> create(@Valid @RequestBody CreateTenantRequest request) {
        TenantService.TenantCreated result = tenantService.create(request.name(), request.schemaName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(TenantCreatedResponse.from(result.tenant(), result.apikey()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TenantResponse> findById(@PathVariable UUID id) {
        Optional<Tenant> tenantOptional = tenantService.findById(id);

        if (tenantOptional.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(TenantResponse.from(tenantOptional.get()));
    }

}
