package com.rishubarman.cabbooking.controller;

import com.rishubarman.cabbooking.entity.Driver;
import com.rishubarman.cabbooking.service.DriverService;
import jakarta.validation.Valid;
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
    public Driver createDriver(@Valid @RequestBody Driver driver) {
        return driverService.createDriver(driver);
    }

    @GetMapping
    public List<Driver> getAllDrivers() {
        return driverService.getAllDrivers();
    }
}