package com.rishubarman.cabbooking.repository;

import com.rishubarman.cabbooking.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    boolean existsByRideId(Long rideId);

    List<Payment> findByRideUserId(Long userId);

    Optional<Payment> findByRazorpayOrderId(String razorpayOrderId);
}
