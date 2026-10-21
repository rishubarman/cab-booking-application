package com.rishubarman.cabbooking.controller;

import com.rishubarman.cabbooking.entity.Rating;
import com.rishubarman.cabbooking.service.RatingService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ratings")
public class RatingController {

    private final RatingService ratingService;

    public RatingController(RatingService ratingService) {
        this.ratingService = ratingService;
    }

    @PostMapping("/ride/{rideId}")
    public Rating createRating(
            @PathVariable Long rideId,
            @Valid @RequestBody Rating rating,
            Authentication authentication) {
        return ratingService.createRating(rideId, rating, authentication.getName());
    }

    @GetMapping
    public List<Rating> getAllRatings() {
        return ratingService.getAllRatings();
    }

    @GetMapping("/ride/{rideId}")
    public ResponseEntity<Rating> getRatingByRideId(@PathVariable Long rideId) {
        return ratingService.getRatingByRideId(rideId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/driver/{driverId}/summary")
    public Map<String, Object> getDriverRatingSummary(@PathVariable Long driverId) {
        return ratingService.getDriverRatingSummary(driverId);
    }

    @GetMapping("/driver/{driverId}/reviews")
    public List<Rating> getDriverReviews(@PathVariable Long driverId) {
        return ratingService.getDriverReviews(driverId);
    }
}
