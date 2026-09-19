package dev.emit.document.adapter.in.rest;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityFilterAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;

import dev.emit.document.application.DocumentService;
import dev.emit.document.domain.Document;
import dev.emit.document.domain.DocumentNotFoundException;
import dev.emit.document.domain.DocumentPdfNotReadyException;
import dev.emit.document.domain.DocumentStatus;
import dev.emit.document.domain.DocumentStatusException;
import dev.emit.shared.ratelimit.RateLimiterService;
import dev.emit.shared.security.JwtService;
import dev.emit.shared.web.ApiErrorWriter;
import dev.emit.tenant.domain.TenantRepository;

@WebMvcTest(value = DocumentController.class, excludeAutoConfiguration = { SecurityAutoConfiguration.class,
        SecurityFilterAutoConfiguration.class })
class DocumentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private DocumentService documentService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private TenantRepository tenantRepository;

    @MockitoBean
    private RateLimiterService rateLimiterService;

    @MockitoBean
    private ApiErrorWriter apiErrorWriter;

    private Document buildDocument() {
        return Document.create("Contract", "Contract content");
    }

    @Test
    void shouldReturnEmptyPageWhenNoDocuments() throws Exception {
        when(documentService.listAll(any(Pageable.class))).thenReturn(Page.empty());

        mockMvc.perform(get("/v1/documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void shouldReturnPageWithDocumentsAndCorrectMetadata() throws Exception {
        Document document = buildDocument();
        Page<Document> page = new PageImpl<>(
                List.of(document),
                PageRequest.of(0, 20),
                1);
        when(documentService.listAll(any(Pageable.class))).thenReturn(page);

        mockMvc.perform(get("/v1/documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].title").value("Contract"))
                .andExpect(jsonPath("$.content[0].status").value("PENDING"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.first").value(true))
                .andExpect(jsonPath("$.last").value(true));
    }

    @Test
    void shouldReturnCreatedDocument() throws Exception {
        Document document = buildDocument();
        when(documentService.create(anyString(), anyString())).thenReturn(document);

        String body = objectMapper.writeValueAsString(
                new CreateDocumentRequest("Contract", "Contract content"));

        mockMvc.perform(post("/v1/documents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Contract"))
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void shouldReturnDocumentById() throws Exception {
        UUID id = UUID.randomUUID();
        Document document = buildDocument();
        when(documentService.findById(id)).thenReturn(document);

        mockMvc.perform(get("/v1/documents/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Contract"))
                .andExpect(jsonPath("$.content").value("Contract content"))
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void shouldReturn404WhenDocumentNotFound() throws Exception {
        UUID id = UUID.randomUUID();
        when(documentService.findById(id)).thenThrow(new DocumentNotFoundException(id));

        mockMvc.perform(get("/v1/documents/" + id))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldReturn400WhenTitleIsBlank() throws Exception {
        String body = objectMapper.writeValueAsString(
                new CreateDocumentRequest("", "Some content"));

        mockMvc.perform(post("/v1/documents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldReturn400WhenTitleExceedsMaxLength() throws Exception {
        String longTitle = "a".repeat(256);
        String body = objectMapper.writeValueAsString(
                new CreateDocumentRequest(longTitle, "Some content"));

        mockMvc.perform(post("/v1/documents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldReturn400WhenContentExceedsMaxLength() throws Exception {
        String longContent = "a".repeat(50001);
        String body = objectMapper.writeValueAsString(
                new CreateDocumentRequest("Title", longContent));

        mockMvc.perform(post("/v1/documents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldReturn202WhenGenerationRequestAccepted() throws Exception {
        UUID id = UUID.randomUUID();
        doNothing().when(documentService).requestGeneration(id);

        mockMvc.perform(post("/v1/documents/" + id + "/generate"))
                .andExpect(status().isAccepted());
    }

    @Test
    void shouldReturn409WhenDocumentIsNotPending() throws Exception {
        UUID id = UUID.randomUUID();
        doThrow(new DocumentStatusException(id, DocumentStatus.PENDING, DocumentStatus.PROCESSING))
                .when(documentService).requestGeneration(id);

        mockMvc.perform(post("/v1/documents/" + id + "/generate"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void shouldReturn404WhenGeneratingForNonExistentDocument() throws Exception {
        UUID id = UUID.randomUUID();
        doThrow(new DocumentNotFoundException(id)).when(documentService).requestGeneration(id);

        mockMvc.perform(post("/v1/documents/" + id + "/generate"))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldReturn400WhenBodyIsMissing() throws Exception {
        mockMvc.perform(post("/v1/documents")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void shouldReturn400WhenContentIsBlank() throws Exception {
        String body = objectMapper.writeValueAsString(
                new CreateDocumentRequest("Valid Title", ""));

        mockMvc.perform(post("/v1/documents")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldReturnPdfWhenDocumentIsDone() throws Exception {
        UUID id = UUID.randomUUID();
        byte[] pdfBytes = new byte[] { 1, 2, 3 };
        when(documentService.getPdf(id)).thenReturn(pdfBytes);

        mockMvc.perform(get("/v1/documents/" + id + "/pdf"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"document-" + id + ".pdf\""))
                .andExpect(content().bytes(pdfBytes));
    }

    @Test
    void shouldReturn404WhenDownloadingPdfForNonExistentDocument() throws Exception {
        UUID id = UUID.randomUUID();
        when(documentService.getPdf(id)).thenThrow(new DocumentNotFoundException(id));

        mockMvc.perform(get("/v1/documents/" + id + "/pdf"))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldReturn409WhenPdfNotReady() throws Exception {
        UUID id = UUID.randomUUID();
        when(documentService.getPdf(id)).thenThrow(new DocumentPdfNotReadyException(id));

        mockMvc.perform(get("/v1/documents/" + id + "/pdf"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }
}
