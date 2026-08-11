package dev.emit.presentation.rest.document;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateDocumentRequest(
                @NotBlank @Size(max = 255, message = "title must not exceed 255 characters") String title,
                @Size(max = 50000, message = "content must not exceed 50000 characters") String content) {
}
