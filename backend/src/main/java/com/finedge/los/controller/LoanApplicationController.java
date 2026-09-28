package com.finedge.los.controller;

import com.finedge.los.dto.ApplicationResponse;
import com.finedge.los.dto.ApplicationDetailResponse;
import com.finedge.los.dto.CreateApplicationRequest;
import com.finedge.los.entity.Document;
import com.finedge.los.entity.LoanApplication;
import com.finedge.los.exception.DocumentStorageException;
import com.finedge.los.service.DocumentStorageService;
import com.finedge.los.service.LoanApplicationService;
import jakarta.validation.Valid;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class LoanApplicationController {

    private static final Logger logger = LoggerFactory.getLogger(LoanApplicationController.class);
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("application/pdf", "image/jpeg", "image/png", "image/jpg");
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024L;

    private final LoanApplicationService service;
    private final DocumentStorageService documentStorage;

    public LoanApplicationController(LoanApplicationService service, DocumentStorageService documentStorage) {
        this.service = service;
        this.documentStorage = documentStorage;
    }

    @GetMapping("/applications")
    public ResponseEntity<List<ApplicationResponse>> getAllApplications() {
        return ResponseEntity.ok(service.getAllApplications());
    }

    @PostMapping("/applications")
    public ResponseEntity<ApplicationDetailResponse> createApplication(@Valid @RequestBody CreateApplicationRequest request) {
        return ResponseEntity.ok(service.createApplicationDetails(request));
    }

    @PutMapping("/applications/{id}")
    public ResponseEntity<ApplicationDetailResponse> updateApplication(
            @PathVariable Long id,
            @Valid @RequestBody CreateApplicationRequest request) {
        return ResponseEntity.ok(service.updateApplicationDetails(id, request));
    }

    @GetMapping("/applications/{id}")
    public ResponseEntity<ApplicationDetailResponse> getApplication(@PathVariable Long id) {
        return ResponseEntity.ok(service.getApplicationDetails(id));
    }

    @PostMapping("/applications/{id}/credit-check")
    public ResponseEntity<ApplicationDetailResponse> runCreditCheck(@PathVariable Long id) {
        return ResponseEntity.ok(service.runCreditCheckDetails(id));
    }

    @PostMapping("/applications/{id}/documents")
    public ResponseEntity<Document> uploadDocument(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @RequestParam("documentType") String documentType,
            @RequestParam("documentName") String documentName) {
        String originalFileName = file == null ? null : file.getOriginalFilename();
        long fileSize = file == null ? 0 : file.getSize();
        String contentType = file == null ? null : file.getContentType();
        logger.debug("Document upload controller entered: applicationId={} documentType={} fileName={} fileSize={} contentType={}",
            id, documentType, originalFileName, fileSize, contentType);
        try {
            return saveDocument(id, file, documentType, documentName);
        } catch (RuntimeException ex) {
            logger.error("Document upload failed: applicationId={} documentType={} fileName={} fileSize={} contentType={} exceptionClass={} exceptionMessage={}",
                    id, documentType, originalFileName, fileSize, contentType, ex.getClass().getName(), ex.getMessage(), ex);
            throw ex;
        }
    }

    private ResponseEntity<Document> saveDocument(Long id, MultipartFile file, String documentType, String documentName) {
        String originalFileName = file == null ? null : file.getOriginalFilename();
        long fileSize = file == null ? 0 : file.getSize();
        if (file == null || file.isEmpty() || file.getSize() <= 0) {
            throw new IllegalArgumentException("File is empty");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("File type is not supported. Please upload a PDF, JPG, or PNG file.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds the 10 MB limit.");
        }
        if (documentName == null || documentName.isBlank()) {
            throw new IllegalArgumentException("Document name is required");
        }

        Document.DocumentType parsedType;
        try {
            if (documentType == null || documentType.isBlank()) {
                throw new IllegalArgumentException();
            }
            parsedType = Document.DocumentType.valueOf(documentType);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unsupported document type: " + documentType);
        }

        logger.debug("Document upload application/document lookup started: applicationId={} documentType={}", id, parsedType);
        Document existingDocument = service.getDocumentByType(id, parsedType);
        logger.debug("Document upload application/document lookup completed: applicationId={} documentType={} existingDocument={}",
                id, parsedType, existingDocument != null);
        String existingStorageKey = existingDocument == null ? null : existingDocument.getFilePath();
        String storageKey;
        try {
            logger.debug("Document file persistence started: applicationId={} documentType={} fileName={} fileSize={}", id, parsedType, originalFileName, fileSize);
            storageKey = documentStorage.store(file);
            logger.debug("Document file persistence completed: applicationId={} documentType={} fileName={} storageKey={}", id, parsedType, originalFileName, storageKey);
        } catch (IOException ex) {
            throw new DocumentStorageException("Document storage failed", ex);
        }

        Document document = new Document();
        document.setDocumentName(documentName.trim());
        document.setDocumentType(parsedType);
        document.setFileName(safeFileName(file.getOriginalFilename()));
        document.setFilePath(storageKey);
        document.setContentType(file.getContentType());
        document.setFileSize(file.getSize());
        document.setStatus(Document.DocumentStatus.UPLOADED);
        document.setUploadedAt(LocalDateTime.now());

        Document savedDocument;
        try {
            logger.debug("Document database persistence started: applicationId={} documentType={} fileName={}", id, parsedType, originalFileName);
            savedDocument = service.addDocument(id, document);
            logger.debug("Document database persistence completed: applicationId={} documentType={} documentId={}", id, parsedType, savedDocument.getId());
        } catch (RuntimeException ex) {
            deleteStoredFile(storageKey);
            throw ex;
        }
        if (existingStorageKey != null && !Objects.equals(existingStorageKey, storageKey)) {
            deleteStoredFile(existingStorageKey);
        }
        logger.debug("Document upload completed: applicationId={} documentType={} documentId={}", id, parsedType, savedDocument.getId());
        return ResponseEntity.ok(savedDocument);
    }

    @GetMapping("/applications/{id}/documents")
    public ResponseEntity<List<Document>> getDocuments(@PathVariable Long id) {
        return ResponseEntity.ok(service.getDocuments(id));
    }

    @GetMapping("/applications/{id}/documents/{documentId}")
    public ResponseEntity<InputStreamResource> downloadDocument(@PathVariable Long id, @PathVariable Long documentId) throws IOException {
        Document document = service.getDocument(id, documentId);
        Path path = documentStorage.resolve(document.getFilePath());
        if (!Files.exists(path)) {
            throw new IllegalArgumentException("Stored document not found");
        }

        InputStreamResource resource = new InputStreamResource(Files.newInputStream(path));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + document.getFileName() + "\"")
                .contentType(MediaType.parseMediaType(document.getContentType()))
                .body(resource);
    }

    @DeleteMapping("/applications/{id}/documents/{documentId}")
    public ResponseEntity<Void> deleteDocument(@PathVariable Long id, @PathVariable Long documentId) {
        Document document = service.getDocument(id, documentId);
        service.deleteDocument(id, documentId);
        deleteStoredFile(document.getFilePath());
        return ResponseEntity.noContent().build();
    }

    private void deleteStoredFile(String storageKey) {
        try {
            documentStorage.delete(storageKey);
        } catch (IOException ex) {
            logger.warn("Could not remove stored document {}", storageKey, ex);
        }
    }

    private String safeFileName(String originalName) {
        if (originalName == null || originalName.isBlank()) {
            return "document";
        }
        String normalized = originalName.replace('\\', '/');
        String fileName = normalized.substring(normalized.lastIndexOf('/') + 1)
            .replaceAll("[<>:\"|?*\\p{Cntrl}]", "_")
            .strip()
            .replaceAll("[. ]+$", "");
        return fileName.isBlank() ? "document" : fileName;
    }

    @PostMapping("/applications/{id}/submit")
    public ResponseEntity<ApplicationDetailResponse> submitApplication(@PathVariable Long id) {
        return ResponseEntity.ok(service.submitApplicationDetails(id));
    }
}
