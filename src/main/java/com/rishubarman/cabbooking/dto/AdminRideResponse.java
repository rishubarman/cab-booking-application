package com.rishubarman.cabbooking.dto;

public record AdminRideResponse(
        Long id,
        String pickupLocation,
        String pickupAddress,
        String dropLocation,
        String dropAddress,
        Double pickupLatitude,
        Double pickupLongitude,
        Double dropLatitude,
        Double dropLongitude,
        Double fare,
        String status,
        Long riderId,
        String riderName,
        String riderEmail,
        Long driverId,
        String driverName,
        String driverEmail
) {
}