package dev.emit.presentation.rest.document;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
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

import dev.emit.application.document.DocumentService;
import dev.emit.application.document.PdfGenerationService;
import dev.emit.domain.document.Document;
import dev.emit.domain.tenant.TenantRepository;
import dev.emit.infrastructure.ratelimit.RateLimiterService;
import dev.emit.infrastructure.security.JwtService;

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
    private PdfGenerationService pdfGenerationService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private TenantRepository tenantRepository;

    @MockitoBean
    private RateLimiterService rateLimiterService;

    private Document buildDocument() {
        Document document = new Document();
        document.setTitle("Contract");
        document.setContent("Contract content");
        document.setStatus("PENDING");
        document.setCreatedAt(OffsetDateTime.now());
        return document;
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
    void shouldReturn404WhenDocumentNotFound() throws Exception {
        UUID id = UUID.randomUUID();
        when(documentService.findById(id)).thenReturn(Optional.empty());

        mockMvc.perform(get("/v1/documents/" + id))
                .andExpect(status().isNotFound());
    }
}
