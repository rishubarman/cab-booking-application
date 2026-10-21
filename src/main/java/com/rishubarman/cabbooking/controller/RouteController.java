package com.rishubarman.cabbooking.controller;

import com.rishubarman.cabbooking.service.RouteService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/routes")
public class RouteController {

    private final RouteService routeService;

    public RouteController(RouteService routeService) {
        this.routeService = routeService;
    }

    @GetMapping("/estimate")
    public RouteService.RouteEstimate estimateRoute(
            @RequestParam double pickupLatitude,
            @RequestParam double pickupLongitude,
            @RequestParam double dropLatitude,
            @RequestParam double dropLongitude,
            Authentication authentication) {

        return routeService.calculateRoute(
                pickupLatitude,
                pickupLongitude,
                dropLatitude,
                dropLongitude
        );
    }
}
