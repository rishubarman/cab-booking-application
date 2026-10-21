
package com.rishubarman.cabbooking.controller;

import com.rishubarman.cabbooking.dto.DriverLocationRequest;
import com.rishubarman.cabbooking.entity.Ride;
import com.rishubarman.cabbooking.service.RideService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/rides")
public class RideController {

    private final RideService rideService;

    public RideController(RideService rideService) {
        this.rideService = rideService;
    }

    // Create a ride for the authenticated rider.
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Ride createRide(
            @Valid @RequestBody Ride ride,
            Authentication authentication) {

        validateCoordinates(ride);

        return rideService.createRideForUser(
                ride,
                authentication.getName()
        );
    }

    // Validate geographic coordinates when supplied.
    private void validateCoordinates(Ride ride) {

        validateLatitude(
                ride.getPickupLatitude(),
                "Pickup latitude"
        );

        validateLongitude(
                ride.getPickupLongitude(),
                "Pickup longitude"
        );

        validateLatitude(
                ride.getDropLatitude(),
                "Drop latitude"
        );

        validateLongitude(
                ride.getDropLongitude(),
                "Drop longitude"
        );

        // Each location must have both coordinates or neither.
        if ((ride.getPickupLatitude() == null)
                != (ride.getPickupLongitude() == null)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Provide both pickup latitude and longitude"
            );
        }

        if ((ride.getDropLatitude() == null)
                != (ride.getDropLongitude() == null)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Provide both drop latitude and longitude"
            );
        }
    }

    private void validateLatitude(
            Double latitude,
            String field) {

        if (latitude != null
                && (!Double.isFinite(latitude)
                || latitude < -90
                || latitude > 90)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    field + " must be between -90 and 90"
            );
        }
    }

    private void validateLongitude(
            Double longitude,
            String field) {

        if (longitude != null
                && (!Double.isFinite(longitude)
                || longitude < -180
                || longitude > 180)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    field + " must be between -180 and 180"
            );
        }
    }

    // Get rides belonging to the authenticated rider.
    @GetMapping
    public List<Ride> getAllRides(
            Authentication authentication) {

        return rideService.getRidesByUserEmail(
                authentication.getName()
        );
    }

    // Get ride history for the authenticated rider.
    @GetMapping("/my-rides")
    public List<Ride> getMyRides(
            Authentication authentication) {

        return rideService.getRidesByUserEmail(
                authentication.getName()
        );
    }

    // Get pending rides. DRIVER role required by security config.
    @GetMapping("/pending")
    public List<Ride> getPendingRides() {
        return rideService.getPendingRides();
    }

    // Accept a ride. DRIVER role required by security config.
    @PutMapping("/{id}/accept")
    public Ride acceptRide(
            @PathVariable Long id,
            Authentication authentication) {

        return rideService.acceptRide(
                id,
                authentication.getName()
        );
    }

    // Get rides assigned to the authenticated driver.
    @GetMapping("/driver/my-rides")
    public List<Ride> getDriverRides(
            Authentication authentication) {

        return rideService.getRidesByDriverEmail(
                authentication.getName()
        );
    }

    // Update the status of a ride assigned to the driver.
    @PutMapping("/{id}/status")
    public Ride updateRideStatus(
            @PathVariable Long id,
            @RequestParam String status,
            Authentication authentication) {

        return rideService.updateRideStatus(
                id,
                status,
                authentication.getName()
        );
    }

    /**
     * Publish the current GPS location of the authenticated
     * driver to the rider assigned to this active ride.
     */
    @PostMapping("/{id}/location")
    public ResponseEntity<Void> updateDriverLocation(
            @PathVariable Long id,
            @Valid @RequestBody DriverLocationRequest request,
            Authentication authentication) {

        rideService.updateDriverLocation(
                id,
                authentication.getName(),
                request.latitude(),
                request.longitude()
        );

        return ResponseEntity.noContent().build();
    }
}
