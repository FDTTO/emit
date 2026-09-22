package dev.emit.document.adapter.in.rest;

import java.util.UUID;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import dev.emit.document.application.DocumentService;
import dev.emit.document.domain.Document;
import dev.emit.shared.openapi.ErrorCase;
import dev.emit.shared.web.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/v1/documents")
@RequiredArgsConstructor
@Tag(name = "Documents")
// Tenant scope. Only the API key resolves a tenant schema in TenantFilter, so
// it is the sole credential under which these operations behave as intended.
@SecurityRequirement(name = "apiKeyAuth")
public class DocumentController {

    private final DocumentService documentService;

    @GetMapping
    @Operation(
            operationId = "listDocuments",
            summary = "List documents",
            description = "Returns a paginated list of documents scoped to the authenticated tenant. "
                    + "Default: 20 per page, ordered by creation date descending.")
    @ApiResponse(responseCode = "200", description = "Document list returned")
    public ResponseEntity<PageResponse<DocumentSummaryResponse>> listAll(
            @ParameterObject @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        PageResponse<DocumentSummaryResponse> page = PageResponse.from(
                documentService.listAll(pageable).map(DocumentSummaryResponse::from));
        return ResponseEntity.ok(page);
    }

    @GetMapping("/{id}")
    @Operation(operationId = "getDocument", summary = "Get document by ID")
    @ApiResponse(responseCode = "200", description = "Document found")
    @ErrorCase(status = 404, name = "unknown-id", summary = "Document not found",
            message = "Document not found: " + ErrorCase.EXAMPLE_ID)
    public ResponseEntity<DocumentResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(DocumentResponse.from(documentService.findById(id)));
    }

    @PostMapping
    @Operation(
            operationId = "createDocument",
            summary = "Create document",
            description = "Creates a document in PENDING status. "
                    + "The `content` field supports HTML and is rendered as-is into the final PDF.")
    @ApiResponse(responseCode = "201", description = "Document created successfully")
    @ErrorCase(status = 400, name = "invalid-body", summary = "Invalid request body",
            message = "content: must not be blank, title: must not be blank")
    public ResponseEntity<DocumentResponse> create(@Valid @RequestBody CreateDocumentRequest request) {
        Document saved = documentService.create(request.title(), request.content());
        return ResponseEntity.status(HttpStatus.CREATED).body(DocumentResponse.from(saved));
    }

    @PostMapping("/{id}/generate")
    @Operation(
            operationId = "requestDocumentGeneration",
            summary = "Request PDF generation",
            description = "Publishes a DocumentGenerationRequestedEvent to Kafka and returns 202 immediately. "
                    + "Generation runs asynchronously: PENDING → PROCESSING → DONE (or FAILED after 3 attempts "
                    + "with 1s + 2s backoff, then routed to the dead-letter queue). "
                    + "Poll GET /{id} to track status.")
    @ApiResponse(responseCode = "202", description = "PDF generation accepted")
    @ErrorCase(status = 404, name = "unknown-id", summary = "Document not found",
            message = "Document not found: " + ErrorCase.EXAMPLE_ID)
    @ErrorCase(status = 409, name = "not-pending", summary = "Document is not in PENDING status",
            message = "Document must be PENDING but is DONE: " + ErrorCase.EXAMPLE_ID)
    public ResponseEntity<Void> generate(@PathVariable UUID id) {
        documentService.requestGeneration(id);
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/{id}/pdf")
    @Operation(
            operationId = "downloadDocumentPdf",
            summary = "Download PDF",
            description = "Returns the generated PDF as application/pdf. Returns 409 if the document status is not DONE.")
    @ApiResponse(responseCode = "200", description = "PDF file returned")
    @ErrorCase(status = 404, name = "unknown-id", summary = "Document not found",
            message = "Document not found: " + ErrorCase.EXAMPLE_ID)
    @ErrorCase(status = 409, name = "pdf-not-ready", summary = "PDF not yet ready: document is still PENDING or PROCESSING",
            message = "PDF not yet available for document: " + ErrorCase.EXAMPLE_ID)
    public ResponseEntity<byte[]> downloadPdf(@PathVariable UUID id) {
        byte[] pdfBytes = documentService.getPdf(id);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(
                ContentDisposition.attachment().filename("document-" + id + ".pdf").build());
        return ResponseEntity.ok().headers(headers).body(pdfBytes);
    }
}
