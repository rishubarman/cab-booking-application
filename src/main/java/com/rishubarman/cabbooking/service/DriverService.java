
package com.rishubarman.cabbooking.service;

import com.rishubarman.cabbooking.dto.CreateDriverRequest;
import com.rishubarman.cabbooking.entity.Driver;
import com.rishubarman.cabbooking.entity.User;
import com.rishubarman.cabbooking.repository.DriverRepository;
import com.rishubarman.cabbooking.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class DriverService {

    private final DriverRepository driverRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DriverService(
            DriverRepository driverRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder) {
        this.driverRepository = driverRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public Driver createDriver(CreateDriverRequest request) {

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException(
                    "An account with this email already exists");
        }

        if (driverRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException(
                    "A driver with this email already exists");
        }

        User user = new User(
                request.getName(),
                request.getEmail(),
                request.getPhone(),
                passwordEncoder.encode(request.getPassword()),
                "DRIVER"
        );

        userRepository.save(user);

        Driver driver = new Driver(
                request.getName(),
                request.getEmail(),
                request.getPhone(),
                request.getVehicleNumber(),
                request.getVehicleType()
        );

        return driverRepository.save(driver);
    }

    public List<Driver> getAllDrivers() {
        return driverRepository.findAll();
    }
}
