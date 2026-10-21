package com.rishubarman.cabbooking.controller;

import com.rishubarman.cabbooking.dto.AdminRideResponse;
import com.rishubarman.cabbooking.dto.AdminUserResponse;
import com.rishubarman.cabbooking.entity.Driver;
import com.rishubarman.cabbooking.entity.Ride;
import com.rishubarman.cabbooking.entity.User;
import com.rishubarman.cabbooking.repository.DriverRepository;
import com.rishubarman.cabbooking.repository.RideRepository;
import com.rishubarman.cabbooking.repository.UserRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final UserRepository userRepository;
    private final RideRepository rideRepository;
    private final DriverRepository driverRepository;

    public AdminController(
            UserRepository userRepository,
            RideRepository rideRepository,
            DriverRepository driverRepository) {
        this.userRepository = userRepository;
        this.rideRepository = rideRepository;
        this.driverRepository = driverRepository;
    }

    @GetMapping("/test")
    public String adminTest() {
        return "Admin access granted";
    }

    @GetMapping("/users")
    public ResponseEntity<List<AdminUserResponse>> getAllUsers() {
        List<AdminUserResponse> users = userRepository.findAll()
                .stream()
                .map(this::toAdminUserResponse)
                .toList();

        return ResponseEntity.ok(users);
    }

    @GetMapping("/rides")
    public ResponseEntity<List<AdminRideResponse>> getAllRides() {
        List<AdminRideResponse> rides = rideRepository.findAll()
                .stream()
                .map(this::toAdminRideResponse)
                .toList();

        return ResponseEntity.ok(rides);
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        List<Ride> rides = rideRepository.findAll();

        long pendingRides = rides.stream()
                .filter(ride -> "PENDING".equalsIgnoreCase(ride.getStatus()))
                .count();

        long inProgressRides = rides.stream()
                .filter(ride -> "IN_PROGRESS".equalsIgnoreCase(ride.getStatus()))
                .count();

        long completedRides = rides.stream()
                .filter(ride -> "COMPLETED".equalsIgnoreCase(ride.getStatus()))
                .count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalUsers", userRepository.count());
        stats.put("totalDrivers", driverRepository.count());
        stats.put("totalRides", rides.size());
        stats.put("pendingRides", pendingRides);
        stats.put("inProgressRides", inProgressRides);
        stats.put("completedRides", completedRides);

        return ResponseEntity.ok(stats);
    }

    private AdminUserResponse toAdminUserResponse(User user) {
        return new AdminUserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole()
        );
    }

    private AdminRideResponse toAdminRideResponse(Ride ride) {
        User rider = ride.getUser();
        Driver driver = ride.getDriver();

        return new AdminRideResponse(
                ride.getId(),
                ride.getPickupLocation(),
                ride.getPickupAddress(),
                ride.getDropLocation(),
                ride.getDropAddress(),
                ride.getPickupLatitude(),
                ride.getPickupLongitude(),
                ride.getDropLatitude(),
                ride.getDropLongitude(),
                ride.getFare(),
                ride.getStatus(),
                rider != null ? rider.getId() : null,
                rider != null ? rider.getName() : null,
                rider != null ? rider.getEmail() : null,
                driver != null ? driver.getId() : null,
                driver != null ? driver.getName() : null,
                driver != null ? driver.getEmail() : null
        );
    }
}