
package com.rishubarman.cabbooking.repository;

import com.rishubarman.cabbooking.entity.Ride;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RideRepository extends JpaRepository<Ride, Long> {

    List<Ride> findByUserId(Long userId);

    List<Ride> findByStatus(String status);

    List<Ride> findByDriverId(Long driverId);
}
