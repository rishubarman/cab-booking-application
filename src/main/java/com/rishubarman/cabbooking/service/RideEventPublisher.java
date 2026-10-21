
package com.rishubarman.cabbooking.service;

import com.rishubarman.cabbooking.entity.Ride;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class RideEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public RideEventPublisher(
            SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishRideCreated(Ride ride) {
        publishRideEvent(ride, "RIDE_CREATED");
        publishAvailabilityEvent(ride, "RIDE_CREATED");
    }

    public void publishRideAccepted(Ride ride) {
        publishRideEvent(ride, "RIDE_ACCEPTED");
        publishAvailabilityEvent(ride, "RIDE_ACCEPTED");
    }

    public void publishRideStatusChanged(Ride ride) {
        publishRideEvent(ride, "RIDE_STATUS_CHANGED");
    }

    /**
     * Send the driver's latest location privately
     * to the rider assigned to this ride.
     */
    public void publishDriverLocation(
            Ride ride,
            double latitude,
            double longitude) {

        if (ride.getUser() == null
                || ride.getUser().getEmail() == null) {
            return;
        }

        Map<String, Object> event = new LinkedHashMap<>();

        event.put("type", "DRIVER_LOCATION_UPDATE");
        event.put("rideId", ride.getId());
        event.put("latitude", latitude);
        event.put("longitude", longitude);

        messagingTemplate.convertAndSendToUser(
                ride.getUser().getEmail(),
                "/queue/rides",
                event
        );
    }

    private void publishRideEvent(
            Ride ride,
            String eventType) {

        Map<String, Object> event = new LinkedHashMap<>();

        event.put("type", eventType);
        event.put("rideId", ride.getId());
        event.put("status", ride.getStatus());

        // Notify the rider assigned to this ride.
        if (ride.getUser() != null
                && ride.getUser().getEmail() != null) {

            messagingTemplate.convertAndSendToUser(
                    ride.getUser().getEmail(),
                    "/queue/rides",
                    event
            );
        }

        // Notify the assigned driver.
        if (ride.getDriver() != null
                && ride.getDriver().getEmail() != null) {

            messagingTemplate.convertAndSendToUser(
                    ride.getDriver().getEmail(),
                    "/queue/rides",
                    event
            );
        }
    }

    private void publishAvailabilityEvent(
            Ride ride,
            String eventType) {

        Map<String, Object> availabilityEvent =
                new LinkedHashMap<>();

        availabilityEvent.put("type", eventType);
        availabilityEvent.put("rideId", ride.getId());

        // Notify drivers about ride availability changes.
        messagingTemplate.convertAndSend(
                "/topic/ride-availability",
                (Object) availabilityEvent
        );
    }
}
