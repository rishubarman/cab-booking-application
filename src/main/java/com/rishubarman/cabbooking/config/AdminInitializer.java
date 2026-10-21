
package com.rishubarman.cabbooking.config;

import com.rishubarman.cabbooking.entity.User;
import com.rishubarman.cabbooking.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class AdminInitializer {

    @Bean
    public CommandLineRunner createInitialAdmin(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.admin.name:}") String adminName,
            @Value("${app.admin.email:}") String adminEmail,
            @Value("${app.admin.phone:}") String adminPhone,
            @Value("${app.admin.password:}") String adminPassword) {

        return args -> {
            if (adminName.isBlank()
                    || adminEmail.isBlank()
                    || adminPhone.isBlank()
                    || adminPassword.isBlank()) {
                System.out.println(
                        "Admin initialization skipped: credentials not configured.");
                return;
            }

            if (userRepository.existsByEmail(adminEmail)) {
                System.out.println(
                        "Admin initialization skipped: email already exists.");
                return;
            }

            User admin = new User(
                    adminName,
                    adminEmail,
                    adminPhone,
                    passwordEncoder.encode(adminPassword),
                    "ADMIN"
            );

            userRepository.save(admin);

            System.out.println("Initial admin account created successfully.");
        };
    }
}
