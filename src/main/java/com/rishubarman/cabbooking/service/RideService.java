
package com.rishubarman.cabbooking.service;

import com.rishubarman.cabbooking.entity.Driver;
import com.rishubarman.cabbooking.entity.Ride;
import com.rishubarman.cabbooking.entity.User;
import com.rishubarman.cabbooking.repository.DriverRepository;
import com.rishubarman.cabbooking.repository.RideRepository;
import com.rishubarman.cabbooking.repository.UserRepository;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

@Service
public class RideService {

    private static final Logger log =
            LoggerFactory.getLogger(RideService.class);

    private final RideRepository rideRepository;
    private final UserRepository userRepository;
    private final DriverRepository driverRepository;
    private final RideEventPublisher rideEventPublisher;
    private final JavaMailSender mailSender;
    private final String mailFrom;

    public RideService(
            RideRepository rideRepository,
            UserRepository userRepository,
            DriverRepository driverRepository,
            RideEventPublisher rideEventPublisher,
            JavaMailSender mailSender,
            @Value("${spring.mail.username:}") String mailFrom) {

        this.rideRepository = rideRepository;
        this.userRepository = userRepository;
        this.driverRepository = driverRepository;
        this.rideEventPublisher = rideEventPublisher;
        this.mailSender = mailSender;
        this.mailFrom = mailFrom;
    }

    // Create a ride.
    public Ride createRide(Ride ride) {
        validateCoordinates(ride);
        return rideRepository.save(ride);
    }

    // Create a ride for the authenticated user.
    @Transactional
    public Ride createRideForUser(Ride ride, String email) {

        validateCoordinates(ride);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        ride.setUser(user);

        if (ride.getStatus() == null
                || ride.getStatus().isBlank()) {
            ride.setStatus("PENDING");
        }

        // Riders cannot assign their own driver.
        ride.setDriver(null);

        Ride savedRide = rideRepository.save(ride);

        publishAfterCommit(() -> {
            rideEventPublisher.publishRideCreated(savedRide);
            sendRideBookedEmail(savedRide);
        });

        return savedRide;
    }

    // Validate pickup and drop coordinates.
    private void validateCoordinates(Ride ride) {
        validateCoordinatePair(
                ride.getPickupLatitude(),
                ride.getPickupLongitude(),
                "Pickup"
        );

        validateCoordinatePair(
                ride.getDropLatitude(),
                ride.getDropLongitude(),
                "Drop"
        );
    }

    private void validateCoordinatePair(
            Double latitude,
            Double longitude,
            String locationName) {

        // Coordinates may be omitted for older requests.
        if (latitude == null && longitude == null) {
            return;
        }

        if (latitude == null || longitude == null) {
            throw new IllegalArgumentException(
                    locationName
                            + " latitude and longitude must both be provided"
            );
        }

        if (!Double.isFinite(latitude)
                || latitude < -90
                || latitude > 90) {

            throw new IllegalArgumentException(
                    "Invalid " + locationName.toLowerCase()
                            + " latitude. Must be between -90 and 90"
            );
        }

        if (!Double.isFinite(longitude)
                || longitude < -180
                || longitude > 180) {

            throw new IllegalArgumentException(
                    "Invalid " + locationName.toLowerCase()
                            + " longitude. Must be between -180 and 180"
            );
        }
    }

    // Get all rides.
    public List<Ride> getAllRides() {
        return rideRepository.findAll();
    }

    // Get rides by user ID.
    public List<Ride> getRidesByUserId(Long userId) {
        return rideRepository.findByUserId(userId);
    }

    // Get rides belonging to the authenticated user.
    public List<Ride> getRidesByUserEmail(String email) {

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        return rideRepository.findByUserId(user.getId());
    }

    // Get all pending rides.
    public List<Ride> getPendingRides() {
        return rideRepository.findByStatus("PENDING");
    }

    // Accept a pending ride as a driver.
    @Transactional
    public Ride acceptRide(Long rideId, String driverEmail) {

        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() ->
                        new RuntimeException("Ride not found"));

        Driver driver = driverRepository.findByEmail(driverEmail)
                .orElseThrow(() ->
                        new RuntimeException("Driver not found"));

        if (!"PENDING".equals(ride.getStatus())
                || ride.getDriver() != null) {

            throw new IllegalStateException(
                    "Ride is no longer available"
            );
        }

        ride.setDriver(driver);
        ride.setStatus("ACCEPTED");

        Ride savedRide = rideRepository.save(ride);

        publishAfterCommit(() -> {
            rideEventPublisher.publishRideAccepted(savedRide);
            sendDriverAcceptedEmail(savedRide);
        });

        return savedRide;
    }

    // Get rides assigned to a driver.
    public List<Ride> getRidesByDriverEmail(String email) {

        Driver driver = driverRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("Driver not found"));

        return rideRepository.findByDriverId(driver.getId());
    }

    // Update a ride assigned to the authenticated driver.
    @Transactional
    public Ride updateRideStatus(
            Long id,
            String status,
            String email) {

        Ride ride = rideRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("Ride not found"));

        Driver driver = driverRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("Driver not found"));

        // A driver can only update their own assigned ride.
        if (ride.getDriver() == null
                || !ride.getDriver().getId().equals(driver.getId())) {

            throw new AccessDeniedException(
                    "You cannot update a ride assigned to another driver"
            );
        }

        // ACCEPTED -> IN_PROGRESS
        if ("ACCEPTED".equals(ride.getStatus())
                && "IN_PROGRESS".equals(status)) {

            ride.setStatus("IN_PROGRESS");

            // IN_PROGRESS -> COMPLETED
        } else if ("IN_PROGRESS".equals(ride.getStatus())
                && "COMPLETED".equals(status)) {

            ride.setStatus("COMPLETED");

        } else {
            throw new IllegalArgumentException(
                    "Invalid status transition. Allowed transitions: "
                            + "ACCEPTED -> IN_PROGRESS -> COMPLETED"
            );
        }

        Ride savedRide = rideRepository.save(ride);

        publishAfterCommit(() -> {
            rideEventPublisher.publishRideStatusChanged(savedRide);

            if ("COMPLETED".equals(savedRide.getStatus())) {
                sendRideCompletedEmail(savedRide);
            }
        });

        return savedRide;
    }

    // Publish a driver's current GPS location.
    @Transactional(readOnly = true)
    public void updateDriverLocation(
            Long rideId,
            String driverEmail,
            double latitude,
            double longitude) {

        if (!Double.isFinite(latitude)
                || latitude < -90
                || latitude > 90
                || !Double.isFinite(longitude)
                || longitude < -180
                || longitude > 180) {

            throw new IllegalArgumentException(
                    "Invalid GPS coordinates"
            );
        }

        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() ->
                        new RuntimeException("Ride not found"));

        if (ride.getDriver() == null
                || !driverEmail.equals(ride.getDriver().getEmail())) {

            throw new AccessDeniedException(
                    "You are not assigned to this ride"
            );
        }

        if (!"ACCEPTED".equals(ride.getStatus())
                && !"IN_PROGRESS".equals(ride.getStatus())) {

            throw new IllegalStateException(
                    "Location updates are allowed only for active rides"
            );
        }

        rideEventPublisher.publishDriverLocation(
                ride,
                latitude,
                longitude
        );
    }

    // Email sent after the ride has been committed to the database.
    private void sendRideBookedEmail(Ride ride) {

        User user = ride.getUser();

        if (user == null) {
            log.warn("Cannot email ride booking confirmation: missing user for ride {}",
                    ride.getId());
            return;
        }

        String body =
                "Hello " + safeText(user.getName()) + ",\n\n"
                        + "Your cab booking has been created successfully.\n\n"
                        + "Ride ID: " + ride.getId() + "\n"
                        + "Pickup: " + safeText(ride.getPickupAddress()) + "\n"
                        + "Destination: " + safeText(ride.getDropAddress()) + "\n"
                        + "Estimated fare: " + formatFare(ride) + "\n"
                        + "Status: " + safeText(ride.getStatus()) + "\n\n"
                        + "We will notify you when a driver accepts your ride.\n\n"
                        + "Thank you for using Cab Booking!";

        sendEmail(
                user.getEmail(),
                "Cab Booking Confirmation - Ride #" + ride.getId(),
                body,
                ride.getId()
        );
    }

    // Email sent when a driver accepts the ride.
    private void sendDriverAcceptedEmail(Ride ride) {

        User user = ride.getUser();
        Driver driver = ride.getDriver();

        if (user == null || driver == null) {
            log.warn("Cannot email driver acceptance: missing user or driver for ride {}",
                    ride.getId());
            return;
        }

        String body =
                "Hello " + safeText(user.getName()) + ",\n\n"
                        + "Good news! A driver has accepted your cab booking.\n\n"
                        + "Ride ID: " + ride.getId() + "\n"
                        + "Driver name: " + safeText(driver.getName()) + "\n"
                        + "Driver email: " + safeText(driver.getEmail()) + "\n"
                        + "Pickup: " + safeText(ride.getPickupAddress()) + "\n"
                        + "Destination: " + safeText(ride.getDropAddress()) + "\n"
                        + "Status: " + safeText(ride.getStatus()) + "\n\n"
                        + "You can follow your ride in the Cab Booking application.\n\n"
                        + "Thank you for using Cab Booking!";

        sendEmail(
                user.getEmail(),
                "Driver Assigned - Ride #" + ride.getId(),
                body,
                ride.getId()
        );
    }

    // Email sent when the driver completes the ride.
    private void sendRideCompletedEmail(Ride ride) {

        User user = ride.getUser();

        if (user == null) {
            log.warn("Cannot email ride completion: missing user for ride {}",
                    ride.getId());
            return;
        }

        String body =
                "Hello " + safeText(user.getName()) + ",\n\n"
                        + "Your ride has been completed successfully.\n\n"
                        + "Ride ID: " + ride.getId() + "\n"
                        + "Pickup: " + safeText(ride.getPickupAddress()) + "\n"
                        + "Destination: " + safeText(ride.getDropAddress()) + "\n"
                        + "Final fare: " + formatFare(ride) + "\n"
                        + "Status: " + safeText(ride.getStatus()) + "\n\n"
                        + "You can view your ride history and payment receipt "
                        + "in the Cab Booking application.\n\n"
                        + "Thank you for riding with us!";

        sendEmail(
                user.getEmail(),
                "Ride Completed - Ride #" + ride.getId(),
                body,
                ride.getId()
        );
    }

    // Shared email sender. Failures are logged and do not undo a saved ride.
    private void sendEmail(
            String recipient,
            String subject,
            String body,
            Long rideId) {

        if (recipient == null || recipient.isBlank()) {
            log.warn("Cannot send email for ride {}: recipient email is missing",
                    rideId);
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();

            MimeMessageHelper helper =
                    new MimeMessageHelper(message, false, "UTF-8");

            helper.setTo(recipient);

            if (mailFrom != null && !mailFrom.isBlank()) {
                helper.setFrom(mailFrom);
            }

            helper.setSubject(subject);
            helper.setText(body, false);

            mailSender.send(message);

            log.info("Email notification sent for ride {} to {}",
                    rideId, recipient);

        } catch (MessagingException | RuntimeException exception) {
            Throwable rootCause =
                    NestedExceptionUtils.getMostSpecificCause(exception);

            log.error(
                    "Ride {} was saved, but email notification to {} failed: {}",
                    rideId,
                    recipient,
                    rootCause == null
                            ? exception.getMessage()
                            : rootCause.getMessage()
            );
        }
    }

    private String formatFare(Ride ride) {
        if (ride.getFare() == null) {
            return "Not available";
        }

        return String.format(
                java.util.Locale.ROOT,
                "INR %.2f",
                ride.getFare()
        );
    }

    private String safeText(String value) {
        return value == null || value.isBlank() ? "N/A" : value;
    }

    // Publish only after a successful database commit.
    private void publishAfterCommit(Runnable action) {

        if (TransactionSynchronizationManager.isActualTransactionActive()) {

            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            action.run();
                        }
                    }
            );

        } else {
            action.run();
        }
    }
}
