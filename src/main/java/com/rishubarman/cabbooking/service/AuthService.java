package com.rishubarman.cabbooking.service;

import com.rishubarman.cabbooking.dto.LoginRequest;
import com.rishubarman.cabbooking.dto.LoginResponse;
import com.rishubarman.cabbooking.entity.User;
import com.rishubarman.cabbooking.repository.UserRepository;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public AuthService(
            AuthenticationManager authenticationManager,
            JwtService jwtService,
            UserRepository userRepository) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    public LoginResponse login(LoginRequest request) {

        Authentication authentication =
                authenticationManager.authenticate(
                        new UsernamePasswordAuthenticationToken(
                                request.getEmail(),
                                request.getPassword()
                        )
                );

        String email = authentication.getName();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new IllegalStateException(
                                "Authenticated user was not found"
                        )
                );

        String token = jwtService.generateToken(email);

        return new LoginResponse(
                "Login successful",
                email,
                token,
                user.getRole()
        );
    }
}
