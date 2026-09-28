package com.finedge.los.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;

public interface DocumentStorageService {
    String store(MultipartFile file) throws IOException;
    Path resolve(String storageKey);
    void delete(String storageKey) throws IOException;
}
