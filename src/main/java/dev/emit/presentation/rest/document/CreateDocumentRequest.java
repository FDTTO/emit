package dev.emit.presentation.rest.document;

import jakarta.validation.constraints.NotBlank;

public record CreateDocumentRequest(
                @NotBlank String title,
                String content) {
}
