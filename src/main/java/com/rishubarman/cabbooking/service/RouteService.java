
package com.rishubarman.cabbooking.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class RouteService {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    private static final double BASE_FARE = 50.0;
    private static final double FARE_PER_KM = 12.0;

    public RouteService(ObjectMapper objectMapper) {
        this.restClient = RestClient.builder()
                .baseUrl("https://router.project-osrm.org")
                .build();
        this.objectMapper = objectMapper;
    }

    public RouteEstimate calculateRoute(
            double pickupLatitude,
            double pickupLongitude,
            double dropLatitude,
            double dropLongitude) {

        validateCoordinates(pickupLatitude, pickupLongitude);
        validateCoordinates(dropLatitude, dropLongitude);

        String path = String.format(
                Locale.ROOT,
                "/route/v1/driving/%.6f,%.6f;%.6f,%.6f",
                pickupLongitude,
                pickupLatitude,
                dropLongitude,
                dropLatitude
        );

        String responseBody = restClient.get()
                .uri(path + "?overview=full&geometries=geojson")
                .header("Accept", "application/json")
                .header("Accept-Encoding", "identity")
                .retrieve()
                .body(String.class);

        if (responseBody == null || responseBody.isBlank()) {
            throw new IllegalStateException(
                    "The routing service returned an empty response");
        }

        JsonNode response;

        try {
            response = objectMapper.readTree(responseBody);
        } catch (Exception exception) {
            throw new IllegalStateException(
                    "The routing service returned invalid JSON");
        }

        if (response == null
                || !"Ok".equals(response.path("code").asText())
                || !response.path("routes").isArray()
                || response.path("routes").isEmpty()) {
            throw new IllegalStateException(
                    "No driving route was found for these locations");
        }

        JsonNode route = response.path("routes").get(0);

        double distanceMeters = route.path("distance").asDouble();
        double durationSeconds = route.path("duration").asDouble();

        if (!Double.isFinite(distanceMeters)
                || !Double.isFinite(durationSeconds)
                || distanceMeters <= 0
                || durationSeconds < 0) {
            throw new IllegalStateException(
                    "The routing service returned invalid route data");
        }

        JsonNode coordinates =
                route.path("geometry").path("coordinates");

        if (!coordinates.isArray() || coordinates.size() < 2) {
            throw new IllegalStateException(
                    "The routing service returned no route geometry");
        }

        List<List<Double>> routeCoordinates = new ArrayList<>();

        for (JsonNode coordinate : coordinates) {
            if (!coordinate.isArray() || coordinate.size() < 2) {
                continue;
            }

            double longitude = coordinate.get(0).asDouble();
            double latitude = coordinate.get(1).asDouble();

            validateCoordinates(latitude, longitude);

            routeCoordinates.add(
                    List.of(latitude, longitude)
            );
        }

        if (routeCoordinates.size() < 2) {
            throw new IllegalStateException(
                    "The routing service returned an invalid route");
        }

        double distanceKm = distanceMeters / 1000.0;
        long etaMinutes = Math.round(durationSeconds / 60.0);
        double fare = BASE_FARE + distanceKm * FARE_PER_KM;

        return new RouteEstimate(
                round(distanceKm, 2),
                etaMinutes,
                round(fare, 2),
                routeCoordinates
        );
    }

    private void validateCoordinates(
            double latitude,
            double longitude) {

        if (!Double.isFinite(latitude)
                || latitude < -90 || latitude > 90) {
            throw new IllegalArgumentException("Invalid latitude");
        }

        if (!Double.isFinite(longitude)
                || longitude < -180 || longitude > 180) {
            throw new IllegalArgumentException("Invalid longitude");
        }
    }

    private double round(double value, int scale) {
        return BigDecimal.valueOf(value)
                .setScale(scale, RoundingMode.HALF_UP)
                .doubleValue();
    }

    public record RouteEstimate(
            double distanceKm,
            long etaMinutes,
            double estimatedFare,
            List<List<Double>> routeCoordinates) {
    }
}
