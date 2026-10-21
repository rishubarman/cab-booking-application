package com.rishubarman.cabbooking.repository;

import com.rishubarman.cabbooking.entity.Rating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RatingRepository extends JpaRepository<Rating, Long> {

    Optional<Rating> findByRideId(Long rideId);

    boolean existsByRideId(Long rideId);

    @Query("""
            SELECT r
            FROM Rating r
            WHERE r.ride.driver.id = :driverId
            """)
    List<Rating> findAllByDriverId(@Param("driverId") Long driverId);
}