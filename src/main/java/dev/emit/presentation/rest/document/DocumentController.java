package dev.emit.presentation.rest.document;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import dev.emit.application.document.DocumentService;
import dev.emit.application.document.PdfGenerationService;
import dev.emit.domain.document.Document;
import dev.emit.presentation.rest.PageResponse;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/v1/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;
    private final PdfGenerationService pdfGenerationService;

    @GetMapping
    @ApiResponse(responseCode = "200", description = "Document list returned")
    @ApiResponse(responseCode = "429", description = "Rate limit exceeded", content = @Content)
    public ResponseEntity<PageResponse<DocumentResponse>> listAll(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        PageResponse<DocumentResponse> page = PageResponse.from(
                documentService.listAll(pageable).map(DocumentResponse::from));
        return ResponseEntity.ok(page);
    }

    @GetMapping("/{id}")
    @ApiResponse(responseCode = "200", description = "Document found")
    @ApiResponse(responseCode = "404", description = "Document not found", content = @Content)
    @ApiResponse(responseCode = "429", description = "Rate limit exceeded", content = @Content)
    public ResponseEntity<DocumentResponse> findById(@PathVariable UUID id) {
        Optional<Document> document = documentService.findById(id);

        if (document.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(DocumentResponse.from(document.get()));
    }

    @PostMapping
    @ApiResponse(responseCode = "201", description = "Document created successfully")
    @ApiResponse(responseCode = "429", description = "Rate limit exceeded", content = @Content)
    public ResponseEntity<DocumentResponse> create(@Valid @RequestBody CreateDocumentRequest request) {
        Document saved = documentService.create(request.title(), request.content());
        return ResponseEntity.status(HttpStatus.CREATED).body(DocumentResponse.from(saved));

    }

    @PostMapping("/{id}/generate")
    @ApiResponse(responseCode = "200", description = "PDF generated successfully", content = @Content(mediaType = "application/pdf"))
    @ApiResponse(responseCode = "404", description = "Document not found", content = @Content)
    @ApiResponse(responseCode = "429", description = "Rate limit exceeded", content = @Content)
    public CompletableFuture<ResponseEntity<byte[]>> generate(@PathVariable UUID id) {
        return pdfGenerationService.generate(id)
                .thenApply(pdf -> ResponseEntity.ok()
                        .header("Content-Type", "application/pdf")
                        .header("Content-Disposition", "attachment; filename=\"document-" + id + ".pdf\"")
                        .body(pdf));
    }

}
