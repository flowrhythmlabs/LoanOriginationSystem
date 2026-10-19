package com.finedge.los.service;

import com.finedge.los.repository.LoanApplicationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class LosNumberGenerator {
    private final LoanApplicationRepository repository;
    private final int year;
    private final AtomicLong counter;

    public LosNumberGenerator() {
        this(null, LocalDate.now().getYear(), 1L);
    }

    @Autowired
    public LosNumberGenerator(LoanApplicationRepository repository) {
        this(repository, LocalDate.now().getYear(), 1L);
    }

    public LosNumberGenerator(LoanApplicationRepository repository, int year, long startingSequence) {
        if (year <= 0) {
            throw new IllegalArgumentException("Year must be positive");
        }
        this.repository = repository;
        this.year = year;
        this.counter = new AtomicLong(startingSequence);
    }

    public String generate() {
        for (int attempt = 0; attempt < 200; attempt++) {
            long sequence = counter.getAndIncrement();
            String candidate = String.format("LOS-%d-%08d", year, sequence);
            if (repository == null || repository.findByLosNumber(candidate).isEmpty()) {
                return candidate;
            }
        }

        throw new IllegalStateException("Unable to generate a unique LOS number for year " + year);
    }
}
