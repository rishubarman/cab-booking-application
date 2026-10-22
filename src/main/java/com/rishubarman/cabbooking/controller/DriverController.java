
package com.rishubarman.cabbooking.controller;

import com.rishubarman.cabbooking.dto.CreateDriverRequest;
import com.rishubarman.cabbooking.entity.Driver;
import com.rishubarman.cabbooking.service.DriverService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/drivers")
public class DriverController {

    private final DriverService driverService;

    public DriverController(DriverService driverService) {
        this.driverService = driverService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public Driver createDriver(
            @Valid @RequestBody CreateDriverRequest request) {
        return driverService.createDriver(request);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<Driver> getAllDrivers() {
        return driverService.getAllDrivers();
    }
}
