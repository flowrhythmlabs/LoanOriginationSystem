package com.finedge.los.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;

public final class DocumentUploadValidator {
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("application/pdf", "image/jpeg", "image/png", "image/jpg");
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024L;

    private DocumentUploadValidator() {}

    public static void validate(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() <= 0) {
            throw new IllegalArgumentException("File is empty");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("File type is not supported. Allowed formats: PDF, JPG, PNG.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds the 5 MB limit.");
        }
        String originalFileName = file.getOriginalFilename();
        String filename = originalFileName == null ? "" : originalFileName.toLowerCase(Locale.ROOT);
        boolean extensionAllowed = filename.endsWith(".pdf") || filename.endsWith(".jpg") || filename.endsWith(".jpeg") || filename.endsWith(".png");
        if (!extensionAllowed) throw new IllegalArgumentException("File type is not supported. Allowed formats: PDF, JPG, PNG.");
        try {
            byte[] header = file.getBytes();
            boolean pdf = header.length >= 5 && header[0] == '%' && header[1] == 'P' && header[2] == 'D' && header[3] == 'F' && header[4] == '-';
            boolean jpg = header.length >= 3 && (header[0] & 0xff) == 0xff && (header[1] & 0xff) == 0xd8 && (header[2] & 0xff) == 0xff;
            boolean png = header.length >= 8 && (header[0] & 0xff) == 0x89 && header[1] == 'P' && header[2] == 'N' && header[3] == 'G' && (header[4] & 0xff) == 0x0d && (header[5] & 0xff) == 0x0a && (header[6] & 0xff) == 0x1a && (header[7] & 0xff) == 0x0a;
            if (!(pdf || jpg || png)) throw new IllegalArgumentException("The file contents do not match a PDF, JPG, or PNG file.");
            if ((contentType.toLowerCase(Locale.ROOT).contains("pdf") && !pdf) || (contentType.toLowerCase(Locale.ROOT).contains("png") && !png) || (contentType.toLowerCase(Locale.ROOT).contains("jpeg") && !jpg)) {
                throw new IllegalArgumentException("File extension and content type do not match. Please upload a valid PDF, JPG, or PNG file.");
            }
        } catch (IOException ex) {
            throw new IllegalArgumentException("File could not be read. Please choose it again.");
        }
    }
}
