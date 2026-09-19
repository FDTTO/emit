package dev.emit.document.adapter.in.rest;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateDocumentRequest(
        @Schema(description = "Document title", example = "Q3 Invoice")
        @NotBlank
        @Size(max = 255, message = "title must not exceed 255 characters")
        String title,
        @Schema(
                description = "Document content. Supports HTML rendered as-is into the PDF.",
                example = "<h1>Invoice</h1><p>Total: $1,200.00</p>")
        @NotBlank
        @Size(max = 50000, message = "content must not exceed 50000 characters")
        String content) {
}
