package com.finedge.los.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class LocalDocumentStorageService implements DocumentStorageService {
    private final Path baseDirectory;

    public LocalDocumentStorageService(@Value("${app.upload.base-dir}") String baseDirectory) {
        this.baseDirectory = Paths.get(baseDirectory).toAbsolutePath().normalize();
    }

    @Override
    public String store(MultipartFile file) throws IOException {
        Files.createDirectories(baseDirectory);
        String originalName = file.getOriginalFilename() == null ? "document" : file.getOriginalFilename();
        String normalizedName = originalName.replace('\\', '/');
        String safeName = normalizedName.substring(normalizedName.lastIndexOf('/') + 1)
                .replaceAll("[<>:\"|?*\\p{Cntrl}]", "_")
                .strip()
                .replaceAll("[. ]+$", "");
        if (safeName.isBlank() || ".".equals(safeName) || "..".equals(safeName)) {
            safeName = "document";
        }
        if (safeName.length() > 120) {
            safeName = safeName.substring(0, 120);
        }
        String storageKey = UUID.randomUUID() + "-" + safeName;
        try (var input = file.getInputStream()) {
            Files.copy(input, resolve(storageKey), StandardCopyOption.REPLACE_EXISTING);
        }
        return storageKey;
    }

    @Override
    public Path resolve(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            throw new IllegalArgumentException("Document storage key is required");
        }
        Path resolved = baseDirectory.resolve(storageKey).normalize();
        if (!resolved.startsWith(baseDirectory)) {
            throw new IllegalArgumentException("Invalid document storage key");
        }
        return resolved;
    }

    @Override
    public void delete(String storageKey) throws IOException {
        Files.deleteIfExists(resolve(storageKey));
    }
}
