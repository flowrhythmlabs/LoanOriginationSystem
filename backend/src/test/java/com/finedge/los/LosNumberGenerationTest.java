package com.finedge.los;

import com.finedge.los.repository.LoanApplicationRepository;
import com.finedge.los.service.LosNumberGenerator;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LosNumberGenerationTest {
    @Test
    void shouldGenerateLosNumberPattern() {
        LosNumberGenerator generator = new LosNumberGenerator();
        String value = generator.generate();
        assertTrue(value.matches("LOS-\\d{4}-\\d{8}"));
    }

    @Test
    void shouldAvoidGeneratingDuplicateLosNumberWhenExistingValueAlreadyExists() {
        LoanApplicationRepository repository = mock(LoanApplicationRepository.class);
        when(repository.findByLosNumber("LOS-2025-00000001")).thenReturn(Optional.of(new com.finedge.los.entity.LoanApplication()));

        LosNumberGenerator generator = new LosNumberGenerator(repository, 2025, 1);
        String value = generator.generate();

        assertNotEquals("LOS-2025-00000001", value);
        assertTrue(value.matches("LOS-2025-\\d{8}"));
    }
}
