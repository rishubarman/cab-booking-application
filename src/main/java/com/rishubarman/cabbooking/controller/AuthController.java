package com.rishubarman.cabbooking.controller;

import com.rishubarman.cabbooking.dto.LoginRequest;
import com.rishubarman.cabbooking.dto.LoginResponse;
import com.rishubarman.cabbooking.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }
}