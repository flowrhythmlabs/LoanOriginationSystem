package com.finedge.los.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public class EmploymentRequest {
    @NotNull(message = "Employment type is required")
    private String employmentType;

    @Size(max = 150, message = "Employer name is too long")
    private String employerName;
    @Size(max = 120, message = "Designation is too long")
    private String designation;
    private Double totalWorkExperienceYears;
    private Double currentEmployerExperienceYears;

    @DecimalMin(value = "0.01", message = "Monthly in-hand salary must be greater than zero")
    private BigDecimal monthlyInHandSalary;

    @DecimalMin(value = "0.00", message = "Monthly gross salary must not be negative")
    private BigDecimal monthlyGrossSalary;

    public EmploymentRequest() {}

    public String getEmploymentType() { return employmentType; }
    public void setEmploymentType(String employmentType) { this.employmentType = employmentType; }
    public String getEmployerName() { return employerName; }
    public void setEmployerName(String employerName) { this.employerName = employerName; }
    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }
    public Double getTotalWorkExperienceYears() { return totalWorkExperienceYears; }
    public void setTotalWorkExperienceYears(Double totalWorkExperienceYears) { this.totalWorkExperienceYears = totalWorkExperienceYears; }
    public Double getCurrentEmployerExperienceYears() { return currentEmployerExperienceYears; }
    public void setCurrentEmployerExperienceYears(Double currentEmployerExperienceYears) { this.currentEmployerExperienceYears = currentEmployerExperienceYears; }
    public BigDecimal getMonthlyInHandSalary() { return monthlyInHandSalary; }
    public void setMonthlyInHandSalary(BigDecimal monthlyInHandSalary) { this.monthlyInHandSalary = monthlyInHandSalary; }
    public BigDecimal getMonthlyGrossSalary() { return monthlyGrossSalary; }
    public void setMonthlyGrossSalary(BigDecimal monthlyGrossSalary) { this.monthlyGrossSalary = monthlyGrossSalary; }
}
