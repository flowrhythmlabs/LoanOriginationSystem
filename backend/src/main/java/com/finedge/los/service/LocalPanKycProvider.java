package com.finedge.los.service;

public class LocalPanKycProvider implements KycProvider {
    @Override
    public boolean isPanFormatValid(String panNumber) {
        return panNumber != null && panNumber.matches("[A-Z]{5}[0-9]{4}[A-Z]");
    }
}