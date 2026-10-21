package com.rishubarman.cabbooking.service;

import com.rishubarman.cabbooking.entity.Rating;
import com.rishubarman.cabbooking.entity.Ride;
import com.rishubarman.cabbooking.entity.User;
import com.rishubarman.cabbooking.repository.RatingRepository;
import com.rishubarman.cabbooking.repository.RideRepository;
import com.rishubarman.cabbooking.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class RatingService {

    private final RatingRepository ratingRepository;
    private final RideRepository rideRepository;
    private final UserRepository userRepository;

    public RatingService(
            RatingRepository ratingRepository,
            RideRepository rideRepository,
            UserRepository userRepository) {
        this.ratingRepository = ratingRepository;
        this.rideRepository = rideRepository;
        this.userRepository = userRepository;
    }

    // Create a rating for a completed ride owned by the authenticated user.
    @Transactional
    public Rating createRating(Long rideId, Rating rating, String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> new RuntimeException("Ride not found"));

        if (ride.getUser() == null
                || !ride.getUser().getId().equals(user.getId())) {
            throw new AccessDeniedException("You can rate only your own rides");
        }

        if (!"COMPLETED".equals(ride.getStatus())) {
            throw new IllegalStateException("You can rate only completed rides");
        }

        if (ratingRepository.existsByRideId(rideId)) {
            throw new IllegalStateException("This ride has already been rated");
        }

        rating.setRide(ride);
        return ratingRepository.save(rating);
    }

    // Get all ratings.
    @Transactional(readOnly = true)
    public List<Rating> getAllRatings() {
        return ratingRepository.findAll();
    }

    // Empty Optional means the ride has not been rated yet.
    @Transactional(readOnly = true)
    public Optional<Rating> getRatingByRideId(Long rideId) {
        return ratingRepository.findByRideId(rideId);
    }

    // Get the average rating and review count for a driver.
    @Transactional(readOnly = true)
    public Map<String, Object> getDriverRatingSummary(Long driverId) {
        List<Rating> ratings = ratingRepository.findAllByDriverId(driverId);

        double averageRating = ratings.stream()
                .mapToInt(Rating::getRating)
                .average()
                .orElse(0.0);

        Map<String, Object> summary = new HashMap<>();
        summary.put("driverId", driverId);
        summary.put("averageRating", Math.round(averageRating * 100.0) / 100.0);
        summary.put("totalReviews", ratings.size());
        return summary;
    }

    // Get all reviews for a driver.
    @Transactional(readOnly = true)
    public List<Rating> getDriverReviews(Long driverId) {
        return ratingRepository.findAllByDriverId(driverId);
    }
}
