
package com.rishubarman.cabbooking.controller;

import com.rishubarman.cabbooking.entity.Ride;
import com.rishubarman.cabbooking.repository.RideRepository;
import com.rishubarman.cabbooking.service.EmailService;
import com.rishubarman.cabbooking.service.ReceiptService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/receipts")
public class ReceiptController {

    private final RideRepository rideRepository;
    private final ReceiptService receiptService;
    private final EmailService emailService;

    public ReceiptController(
            RideRepository rideRepository,
            ReceiptService receiptService,
            EmailService emailService) {
        this.rideRepository = rideRepository;
        this.receiptService = receiptService;
        this.emailService = emailService;
    }

    // Download a PDF receipt for the authenticated rider's completed ride
    @GetMapping("/rides/{rideId}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<byte[]> downloadReceipt(
            @PathVariable Long rideId,
            Authentication authentication) {

        Ride ride = getAuthorizedCompletedRide(
                rideId, authentication.getName());

        byte[] pdf = receiptService.generateReceipt(ride);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=ride-receipt-" + rideId + ".pdf")
                .body(pdf);
    }

    // Email a PDF receipt to the authenticated rider's registered email
    @PostMapping("/rides/{rideId}/email")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<Map<String, String>> emailReceipt(
            @PathVariable Long rideId,
            Authentication authentication) {

        Ride ride = getAuthorizedCompletedRide(
                rideId, authentication.getName());

        byte[] pdf = receiptService.generateReceipt(ride);

        emailService.sendReceiptEmail(
                ride.getUser().getEmail(),
                ride.getUser().getName(),
                ride.getId(),
                pdf
        );

        return ResponseEntity.ok(Map.of(
                "message", "Receipt email sent successfully",
                "rideId", rideId.toString()
        ));
    }

    private Ride getAuthorizedCompletedRide(
            Long rideId, String authenticatedEmail) {

        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Ride not found"));

        if (ride.getUser() == null
                || !ride.getUser().getEmail().equals(authenticatedEmail)) {
            throw new IllegalArgumentException(
                    "You are not allowed to access this ride receipt");
        }

        if (!"COMPLETED".equalsIgnoreCase(ride.getStatus())) {
            throw new IllegalStateException(
                    "Receipt is available only for completed rides");
        }

        return ride;
    }
}
