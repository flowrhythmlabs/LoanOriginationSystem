package com.finedge.los.service;

import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class DemoUserDetailsService implements UserDetailsService {
    private static final String DEFAULT_USER_OTP = "123456";
    private final Map<String, UserDetails> users = new ConcurrentHashMap<>();
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public DemoUserDetailsService() {
        users.put("admin", User.withUsername("admin").password(passwordEncoder.encode("admin")).roles("ADMIN").build());
    }

    public void registerUser(String mobileNumber, String otp) {
        String username = "USER_" + normalizeMobile(mobileNumber);
        users.put(username, User.withUsername(username).password(passwordEncoder.encode(otp)).roles("USER").build());
    }

    public boolean validateUserOtp(String mobileNumber, String otp) {
        String normalizedMobile = normalizeMobile(mobileNumber);
        String expectedOtp = DEFAULT_USER_OTP;
        String username = "USER_" + normalizedMobile;
        if (users.containsKey(username)) {
            return otp != null && passwordEncoder.matches(otp, users.get(username).getPassword());
        }
        return otp != null && otp.equals(expectedOtp);
    }

    public boolean validateAdmin(String username, String password) {
        UserDetails user = users.get(username);
        return user != null && "admin".equals(username) && passwordEncoder.matches(password, user.getPassword());
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        UserDetails user = users.get(username);
        if (user == null) {
            throw new UsernameNotFoundException("User not found: " + username);
        }
        return user;
    }

    private String normalizeMobile(String mobileNumber) {
        if (mobileNumber == null) {
            return "";
        }
        return mobileNumber.replaceAll("\\D+", "");
    }
}
