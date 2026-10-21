import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Polyline,
    useMap,
    useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./index.css";


const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";


const defaultPosition = [30.769, 76.5754];
const defaultDrop = [30.7056, 76.801];

const pickupIcon = new L.Icon({
    iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

const dropIcon = new L.Icon({
    iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

const driverIcon = new L.Icon({
    iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

function LocationSelector({ selection, setPickup, setDrop }) {
    useMapEvents({
        click(event) {
            const coordinates = [
                event.latlng.lat,
                event.latlng.lng,
            ];

            if (selection === "pickup") {
                setPickup(coordinates);
            } else {
                setDrop(coordinates);
            }
        },
    });

    return null;
}

function FitRoute({ pickup, drop, routeCoordinates }) {
    const map = useMap();

    useEffect(() => {
        const points =
            routeCoordinates.length > 1
                ? routeCoordinates
                : [pickup, drop];

        const bounds = L.latLngBounds(points);

        if (bounds.isValid()) {
            map.fitBounds(bounds, {
                padding: [40, 40],
                maxZoom: 15,
                animate: true,
            });
        }
    }, [map, pickup, drop, routeCoordinates]);

    return null;
}

async function apiRequest(path, token, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            ...(options.body
                ? { "Content-Type": "application/json" }
                : {}),
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(
            data?.message ||
            data?.error ||
            `Request failed (${response.status})`
        );
    }

    return data;
}

function formatFare(fare) {
    const value = Number(fare);

    return Number.isFinite(value)
        ? `₹${value.toFixed(2)}`
        : "Not available";
}

function formatLocation(location) {
    return location || "Location not provided";
}

function findPaymentForRide(payments, rideId) {
    return payments.find((payment) => {
        const paymentRideId =
            payment.ride?.id ??
            payment.rideId ??
            payment.ride?.rideId;

        return Number(paymentRideId) === Number(rideId);
    });
}

async function reverseGeocode(latitude, longitude) {
    const params = new URLSearchParams({
        format: "jsonv2",
        lat: String(latitude),
        lon: String(longitude),
        addressdetails: "1",
    });

    const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
        {
            headers: {
                Accept: "application/json",
            },
        }
    );

    if (!response.ok) {
        throw new Error("Unable to look up this address.");
    }

    const data = await response.json();
    const address = data.address || {};

    const name =
        data.name ||
        address.road ||
        address.suburb ||
        address.neighbourhood ||
        address.residential ||
        address.town ||
        address.city ||
        address.village ||
        address.county ||
        data.display_name ||
        "Selected map location";

    return {
        name,
        address: data.display_name || name,
    };
}

function StatusBadge({ status }) {
    const colors = {
        PENDING: { background: "#fef3c7", color: "#92400e" },
        ACCEPTED: { background: "#dbeafe", color: "#1d4ed8" },
        IN_PROGRESS: { background: "#ede9fe", color: "#6d28d9" },
        COMPLETED: { background: "#dcfce7", color: "#166534" },
        CANCELLED: { background: "#fee2e2", color: "#991b1b" },
    };

    const style = colors[status] || {
        background: "#e5e7eb",
        color: "#374151",
    };

    return (
        <span
            style={{
                display: "inline-block",
                padding: "5px 10px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                background: style.background,
                color: style.color,
            }}
        >
            {status || "UNKNOWN"}
        </span>
    );
}

export default function App() {
    const [pickup, setPickup] = useState(defaultPosition);
    const [drop, setDrop] = useState(defaultDrop);

    const [pickupPlace, setPickupPlace] = useState({
        name: "Chandigarh University",
        address: "",
    });

    const [dropPlace, setDropPlace] = useState({
        name: "Elante Mall",
        address: "",
    });

    const [resolvingPickup, setResolvingPickup] = useState(true);
    const [resolvingDrop, setResolvingDrop] = useState(true);
    const [selection, setSelection] = useState("pickup");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [token, setToken] = useState("");
    const [role, setRole] = useState("");
    const [webSocketConnected, setWebSocketConnected] = useState(false);
    const [notifications, setNotifications] = useState([]);

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);

    const [routeEstimate, setRouteEstimate] = useState(null);
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const [ride, setRide] = useState(null);
    const [trackedDriverLocation, setTrackedDriverLocation] = useState(null);
    const lastGpsSentAtRef = useRef({});

    const [riderHistory, setRiderHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [paymentHistoryLoaded, setPaymentHistoryLoaded] = useState(false);
    const [receiptAction, setReceiptAction] = useState("");

    // Ratings for completed rides and the rider's editable rating drafts.
    const [rideRatings, setRideRatings] = useState({});
    const [ratingDrafts, setRatingDrafts] = useState({});
    const [submittingRatingId, setSubmittingRatingId] = useState(null);

    // Tracks the ride currently being paid for.
    const [payingRideId, setPayingRideId] = useState(null);

    const [pendingRides, setPendingRides] = useState([]);
    const [driverRides, setDriverRides] = useState([]);
    const [driverRatingSummary, setDriverRatingSummary] = useState(null);
    const [driverReviews, setDriverReviews] = useState([]);
    const [refreshingRides, setRefreshingRides] = useState(false);
    // Admin dashboard state
    const [adminStats, setAdminStats] = useState(null);
    const [adminUsers, setAdminUsers] = useState([]);
    const [adminRides, setAdminRides] = useState([]);
    const [adminPayments, setAdminPayments] = useState([]);
    const [loadingAdmin, setLoadingAdmin] = useState(false);
    const [paymentSearch, setPaymentSearch] = useState("");
    const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");
    const [paymentMethodFilter, setPaymentMethodFilter] = useState("ALL");

    // Prevent older address requests from overwriting newer selections.
    const pickupLookupId = useRef(0);
    const dropLookupId = useRef(0);

    // Reverse-geocode both default locations on initial load.
    useEffect(() => {
        let cancelled = false;

        const pickupRequestId = ++pickupLookupId.current;
        const dropRequestId = ++dropLookupId.current;

        async function resolveInitialPickup() {
            try {
                const place = await reverseGeocode(
                    defaultPosition[0],
                    defaultPosition[1]
                );

                if (
                    !cancelled &&
                    pickupLookupId.current === pickupRequestId
                ) {
                    setPickupPlace(place);
                }
            } catch {
                if (
                    !cancelled &&
                    pickupLookupId.current === pickupRequestId
                ) {
                    setPickupPlace({
                        name: "Chandigarh University",
                        address: "",
                    });
                }
            } finally {
                if (
                    !cancelled &&
                    pickupLookupId.current === pickupRequestId
                ) {
                    setResolvingPickup(false);
                }
            }
        }

        async function resolveInitialDrop() {
            try {
                const place = await reverseGeocode(
                    defaultDrop[0],
                    defaultDrop[1]
                );

                if (
                    !cancelled &&
                    dropLookupId.current === dropRequestId
                ) {
                    setDropPlace(place);
                }
            } catch {
                if (
                    !cancelled &&
                    dropLookupId.current === dropRequestId
                ) {
                    setDropPlace({
                        name: "Elante Mall",
                        address: "",
                    });
                }
            } finally {
                if (
                    !cancelled &&
                    dropLookupId.current === dropRequestId
                ) {
                    setResolvingDrop(false);
                }
            }
        }

        resolveInitialPickup();
        resolveInitialDrop();

        return () => {
            cancelled = true;
        };
    }, []);

    async function loadRiderHistory(authToken = token) {
        if (!authToken) return;

        setLoadingHistory(true);
        setPaymentHistoryLoaded(false);

        try {
            const data = await apiRequest(
                "/rides/my-rides",
                authToken
            );

            if (!Array.isArray(data)) {
                throw new Error(
                    "The server returned an invalid ride history."
                );
            }

            setRiderHistory(data);

            // Load existing ratings for completed rides. The backend returns 204
            // when no rating exists, which apiRequest safely parses as null.
            const completedRides = data.filter(
                (item) => String(item.status).toUpperCase() === "COMPLETED"
            );
            const ratingEntries = await Promise.all(
                completedRides.map(async (item) => {
                    try {
                        const rating = await apiRequest(
                            `/ratings/ride/${item.id}`,
                            authToken
                        );
                        return [item.id, rating];
                    } catch (error) {
                        console.error(
                            `Unable to load rating for ride ${item.id}:`,
                            error.message
                        );
                        return [item.id, null];
                    }
                })
            );
            setRideRatings((previous) => ({
                ...previous,
                ...Object.fromEntries(ratingEntries),
            }));

            try {
                const payments = await apiRequest(
                    "/payments/my-payments",
                    authToken
                );

                if (!Array.isArray(payments)) {
                    throw new Error(
                        "The server returned an invalid payment history."
                    );
                }

                setPaymentHistory(payments);
                setPaymentHistoryLoaded(true);
            } catch (paymentError) {
                setPaymentHistory([]);
                setMessage(
                    `Rides loaded, but payment status could not be checked: ${paymentError.message}`
                );
            }
        } catch (error) {
            setMessage(
                `Unable to load ride history: ${error.message}`
            );
        } finally {
            setLoadingHistory(false);
        }
    }

    async function submitRideRating(rideId) {
        if (!token || role !== "USER") {
            setMessage("Please log in with your rider account to submit a rating.");
            return;
        }

        const draft = ratingDrafts[rideId] || { rating: 5, comment: "" };
        const score = Number(draft.rating);
        const comment = String(draft.comment || "").trim();

        if (!Number.isInteger(score) || score < 1 || score > 5) {
            setMessage("Please select a rating from 1 to 5 stars.");
            return;
        }

        setSubmittingRatingId(rideId);
        setMessage("");

        try {
            const savedRating = await apiRequest(
                `/ratings/ride/${rideId}`,
                token,
                {
                    method: "POST",
                    body: JSON.stringify({ rating: score, comment }),
                }
            );

            setRideRatings((previous) => ({
                ...previous,
                [rideId]: savedRating,
            }));
            setMessage(`Thank you! Your rating for Ride #${rideId} was saved.`);
        } catch (error) {
            setMessage(`Unable to save your rating: ${error.message}`);
        } finally {
            setSubmittingRatingId(null);
        }
    }

    async function downloadReceipt(paymentId) {
        if (!token || role !== "USER") {
            setMessage("Please log in with your rider account.");
            return;
        }

        setReceiptAction(`download-${paymentId}`);
        setMessage("");

        try {
            const response = await fetch(
                `${API_URL}/payments/my-payments/${paymentId}/invoice`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(
                    errorData?.message ||
                    errorData?.error ||
                    `Unable to download receipt (${response.status})`
                );
            }

            const blob = await response.blob();
            const fileUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = fileUrl;
            link.download = `cab-booking-receipt-${paymentId}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => window.URL.revokeObjectURL(fileUrl), 1000);

            setMessage(`Receipt for Payment #${paymentId} downloaded.`);
        } catch (error) {
            setMessage(`Receipt download failed: ${error.message}`);
        } finally {
            setReceiptAction("");
        }
    }

    async function emailReceipt(paymentId) {
        if (!token || role !== "USER") {
            setMessage("Please log in with your rider account.");
            return;
        }

        setReceiptAction(`email-${paymentId}`);
        setMessage("");

        try {
            const result = await apiRequest(
                `/payments/my-payments/${paymentId}/email-receipt`,
                token,
                { method: "POST" }
            );

            setMessage(
                result?.message ||
                `Receipt email request completed for Payment #${paymentId}.`
            );
        } catch (error) {
            setMessage(`Unable to email receipt: ${error.message}`);
        } finally {
            setReceiptAction("");
        }
    }

    // Razorpay Checkout integration.
    async function payForRide(rideId) {
        if (!token || role !== "USER") {
            setMessage("Please log in with your rider account.");
            return;
        }

        setPayingRideId(rideId);
        setMessage("");

        try {
            // Load Razorpay Checkout when needed.
            if (!window.Razorpay) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement("script");

                    script.src =
                        "https://checkout.razorpay.com/v1/checkout.js";

                    script.onload = resolve;
                    script.onerror = () =>
                        reject(
                            new Error(
                                "Unable to load Razorpay Checkout."
                            )
                        );

                    document.body.appendChild(script);
                });
            }

            // Create the order through the Spring Boot backend.
            const order = await apiRequest(
                "/payments/razorpay/order",
                token,
                {
                    method: "POST",
                    body: JSON.stringify({ rideId }),
                }
            );

            const options = {
                key: order.keyId,
                amount: order.amount,
                currency: order.currency,
                name: "Cab Booking",
                description: `Payment for Ride #${rideId}`,
                order_id: order.orderId,

                handler: async function (response) {
                    try {
                        setMessage("Verifying your payment...");

                        await apiRequest(
                            "/payments/razorpay/verify",
                            token,
                            {
                                method: "POST",
                                body: JSON.stringify({
                                    paymentId: order.paymentId,
                                    razorpay_order_id:
                                    response.razorpay_order_id,
                                    razorpay_payment_id:
                                    response.razorpay_payment_id,
                                    razorpay_signature:
                                    response.razorpay_signature,
                                }),
                            }
                        );

                        setMessage(
                            `Payment verification succeeded for Ride #${rideId}.`
                        );

                        await loadRiderHistory();
                    } catch (error) {
                        setMessage(
                            `Payment verification failed: ${error.message}`
                        );
                    } finally {
                        setPayingRideId(null);
                    }
                },

                modal: {
                    ondismiss: function () {
                        setMessage(
                            "Checkout closed. Your payment may still be pending."
                        );
                        setPayingRideId(null);
                    },
                },

                theme: {
                    color: "#2563eb",
                },
            };

            const checkout = new window.Razorpay(options);

            checkout.on("payment.failed", function (response) {
                setMessage(
                    response.error?.description ||
                    "Payment failed. Please try again."
                );
                setPayingRideId(null);
            });

            checkout.open();
        } catch (error) {
            setMessage(
                error.message || "Unable to start payment."
            );
            setPayingRideId(null);
        }
    }

    async function login(event) {
        event.preventDefault();

        setLoading(true);
        setMessage("");

        try {
            const response = await fetch(
                `${API_URL}/auth/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ email, password }),
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.error ||
                    `Login failed (${response.status})`
                );
            }

            const receivedToken = data.token || data.accessToken;
            const receivedRole = String(
                data.role || ""
            ).toUpperCase();

            if (!receivedToken) {
                throw new Error(
                    "Login response did not contain a token."
                );
            }

            if (!["USER", "DRIVER", "ADMIN"].includes(receivedRole)) {
                throw new Error(
                    "The server did not return a valid account role."
                );
            }

            setToken(receivedToken);
            setRole(receivedRole);
            setEmail(data.email || email);
            setPassword("");

            setRouteEstimate(null);
            setRouteCoordinates([]);
            setRide(null);
            setTrackedDriverLocation(null);
            lastGpsSentAtRef.current = {};
            setNotifications([]);
            setRiderHistory([]);
            setPaymentHistory([]);
            setPaymentHistoryLoaded(false);
            setRideRatings({});
            setRatingDrafts({});
            setSubmittingRatingId(null);
            setPendingRides([]);
            setDriverRides([]);
            setAdminStats(null);
            setAdminUsers([]);
            setAdminRides([]);
            setAdminPayments([]);

            if (receivedRole === "USER") {
                setMessage("Rider login successful.");
                await loadRiderHistory(receivedToken);
            } else if (receivedRole === "DRIVER") {
                setMessage("Driver login successful.");
                await loadDriverRides(receivedToken);
            } else {
                setMessage("Admin login successful.");
                await loadAdminDashboard(receivedToken);
            }
        } catch (error) {
            setMessage(error.message || "Unable to log in.");
        } finally {
            setLoading(false);
        }
    }

    async function changePickup(coordinates) {
        setPickup(coordinates);

        const requestId = ++pickupLookupId.current;

        setPickupPlace({
            name: "Finding pickup address...",
            address: "",
        });

        setResolvingPickup(true);
        setRouteEstimate(null);
        setRouteCoordinates([]);
        setRide(null);
        setMessage("");

        try {
            const place = await reverseGeocode(
                coordinates[0],
                coordinates[1]
            );

            if (pickupLookupId.current === requestId) {
                setPickupPlace(place);
            }
        } catch {
            if (pickupLookupId.current === requestId) {
                setPickupPlace({
                    name: "Selected map location",
                    address:
                        "Address lookup failed. Please try selecting this location again.",
                });
            }
        } finally {
            if (pickupLookupId.current === requestId) {
                setResolvingPickup(false);
            }
        }
    }

    async function changeDrop(coordinates) {
        setDrop(coordinates);

        const requestId = ++dropLookupId.current;

        setDropPlace({
            name: "Finding destination address...",
            address: "",
        });

        setResolvingDrop(true);
        setRouteEstimate(null);
        setRouteCoordinates([]);
        setRide(null);
        setMessage("");

        try {
            const place = await reverseGeocode(
                coordinates[0],
                coordinates[1]
            );

            if (dropLookupId.current === requestId) {
                setDropPlace(place);
            }
        } catch {
            if (dropLookupId.current === requestId) {
                setDropPlace({
                    name: "Selected destination",
                    address:
                        "Address lookup failed. Please try selecting this location again.",
                });
            }
        } finally {
            if (dropLookupId.current === requestId) {
                setResolvingDrop(false);
            }
        }
    }

    async function calculateFare() {
        if (!token || role !== "USER") {
            setMessage("Please log in with a rider account first.");
            return;
        }

        if (resolvingPickup || resolvingDrop) {
            setMessage(
                "Please wait until both addresses are resolved."
            );
            return;
        }

        setCalculating(true);
        setMessage("");
        setRouteEstimate(null);
        setRouteCoordinates([]);
        setRide(null);

        try {
            const params = new URLSearchParams({
                pickupLatitude: String(pickup[0]),
                pickupLongitude: String(pickup[1]),
                dropLatitude: String(drop[0]),
                dropLongitude: String(drop[1]),
            });

            const data = await apiRequest(
                `/routes/estimate?${params.toString()}`,
                token
            );

            if (
                !Number.isFinite(data.distanceKm) ||
                !Number.isFinite(data.etaMinutes) ||
                !Number.isFinite(data.estimatedFare)
            ) {
                throw new Error(
                    "The backend returned an invalid route estimate."
                );
            }

            setRouteEstimate(data);

            const validCoordinates = Array.isArray(
                data.routeCoordinates
            )
                ? data.routeCoordinates.filter(
                    (point) =>
                        Array.isArray(point) &&
                        point.length >= 2 &&
                        Number.isFinite(point[0]) &&
                        Number.isFinite(point[1]) &&
                        point[0] >= -90 &&
                        point[0] <= 90 &&
                        point[1] >= -180 &&
                        point[1] <= 180
                )
                : [];

            setRouteCoordinates(validCoordinates);
            setMessage("Route and fare calculated successfully.");
        } catch (error) {
            setMessage(
                error.message || "Unable to calculate the route."
            );
        } finally {
            setCalculating(false);
        }
    }

    async function bookRide() {
        if (!token || role !== "USER") {
            setMessage(
                "Please log in with a rider account before booking."
            );
            return;
        }

        if (!routeEstimate) {
            setMessage(
                "Calculate the fare before booking your ride."
            );
            return;
        }

        if (resolvingPickup || resolvingDrop) {
            setMessage(
                "Please wait until both addresses are resolved."
            );
            return;
        }

        if (!pickupPlace.name || !dropPlace.name) {
            setMessage(
                "Pickup and destination names are required. Please select the locations again."
            );
            return;
        }

        setLoading(true);
        setMessage("");
        setRide(null);

        try {
            const data = await apiRequest("/rides", token, {
                method: "POST",
                body: JSON.stringify({
                    pickupLocation: pickupPlace.name,
                    dropLocation: dropPlace.name,

                    pickupAddress:
                        pickupPlace.address || pickupPlace.name,
                    dropAddress:
                        dropPlace.address || dropPlace.name,

                    pickupLatitude: pickup[0],
                    pickupLongitude: pickup[1],
                    dropLatitude: drop[0],
                    dropLongitude: drop[1],

                    fare: routeEstimate.estimatedFare,
                    status: "PENDING",
                }),
            });

            setRide(data);
            setTrackedDriverLocation(null);
            setMessage(
                `Ride booked successfully. Ride ID: ${data.id}`
            );

            await loadRiderHistory();
        } catch (error) {
            setMessage(
                error.message || "Unable to book the ride."
            );
        } finally {
            setLoading(false);
        }
    }


    async function loadDriverRides(authToken = token) {
        if (!authToken) return;

        setRefreshingRides(true);
        setMessage("");

        try {
            const [pendingData, assignedData] = await Promise.all([
                apiRequest("/rides/pending", authToken),
                apiRequest("/rides/driver/my-rides", authToken),
            ]);

            setPendingRides(
                Array.isArray(pendingData) ? pendingData : []
            );

            const assigned = Array.isArray(assignedData) ? assignedData : [];
            setDriverRides(assigned);

            // The assigned ride response normally includes the assigned Driver entity.
            // Use its ID to load the rating summary and reviews without guessing an ID.
            const driverId = assigned
                .map((item) => item?.driver?.id ?? item?.driverId)
                .find((id) => id !== undefined && id !== null);

            if (driverId !== undefined) {
                const [summaryResult, reviewsResult] = await Promise.allSettled([
                    apiRequest(`/ratings/driver/${driverId}/summary`, authToken),
                    apiRequest(`/ratings/driver/${driverId}/reviews`, authToken),
                ]);
                setDriverRatingSummary(
                    summaryResult.status === "fulfilled" ? summaryResult.value : null
                );
                setDriverReviews(
                    reviewsResult.status === "fulfilled" && Array.isArray(reviewsResult.value)
                        ? reviewsResult.value
                        : []
                );
            } else {
                setDriverRatingSummary(null);
                setDriverReviews([]);
            }
        } catch (error) {
            setMessage(
                `Unable to load driver rides: ${error.message}`
            );
        } finally {
            setRefreshingRides(false);
        }
    }

    async function loadAdminDashboard(authToken = token) {
        if (!authToken) {
            setMessage("Please log in with your admin account.");
            return;
        }

        setLoadingAdmin(true);
        setMessage("");

        try {
            const [stats, users, rides, payments] = await Promise.all([
                apiRequest("/admin/stats", authToken),
                apiRequest("/admin/users", authToken),
                apiRequest("/admin/rides", authToken),
                apiRequest("/payments", authToken),
            ]);

            setAdminStats(stats);
            setAdminUsers(Array.isArray(users) ? users : []);
            setAdminRides(Array.isArray(rides) ? rides : []);
            setAdminPayments(Array.isArray(payments) ? payments : []);

            setMessage("Admin dashboard loaded successfully.");
        } catch (error) {
            setMessage(
                `Unable to load admin dashboard: ${error.message}`
            );
        } finally {
            setLoadingAdmin(false);
        }
    }

    async function acceptRide(rideId) {
        setLoading(true);
        setMessage("");

        try {
            await apiRequest(`/rides/${rideId}/accept`, token, {
                method: "PUT",
            });

            setMessage(
                `Ride ${rideId} accepted successfully.`
            );

            await loadDriverRides();
        } catch (error) {
            setMessage(
                error.message || "Unable to accept this ride."
            );
        } finally {
            setLoading(false);
        }
    }

    async function updateRideStatus(rideId, status) {
        setLoading(true);
        setMessage("");

        try {
            await apiRequest(
                `/rides/${rideId}/status?status=${encodeURIComponent(status)}`,
                token,
                { method: "PUT" }
            );

            setMessage(
                `Ride ${rideId} updated to ${status}.`
            );

            await loadDriverRides();
        } catch (error) {
            setMessage(
                error.message || "Unable to update ride status."
            );
        } finally {
            setLoading(false);
        }
    }

    function logout() {
        setToken("");
        setRole("");
        setPassword("");
        setRouteEstimate(null);
        setRouteCoordinates([]);
        setRide(null);
        setTrackedDriverLocation(null);
        lastGpsSentAtRef.current = {};
        setNotifications([]);
        setRiderHistory([]);
        setPaymentHistory([]);
        setPaymentHistoryLoaded(false);
        setRideRatings({});
        setRatingDrafts({});
        setSubmittingRatingId(null);
        setPendingRides([]);
        setDriverRides([]);
        setAdminStats(null);
        setAdminUsers([]);
        setAdminRides([]);
        setAdminPayments([]);
        setPayingRideId(null);
        setMessage("You have logged out.");
    }

    function renderDriverRideCard(item, showAccept = false) {
        return (
            <article
                key={item.id}
                style={{
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 12,
                    background: "#fff",
                }}
            >
                <h3>Ride #{item.id}</h3>

                <p>
                    <strong>Pickup:</strong>{" "}
                    {formatLocation(item.pickupLocation)}
                </p>

                {item.pickupAddress && (
                    <p style={{ color: "#555" }}>
                        {item.pickupAddress}
                    </p>
                )}

                <p>
                    <strong>Destination:</strong>{" "}
                    {formatLocation(item.dropLocation)}
                </p>

                {item.dropAddress && (
                    <p style={{ color: "#555" }}>
                        {item.dropAddress}
                    </p>
                )}

                <p>
                    <strong>Fare:</strong> {formatFare(item.fare)}
                </p>

                <p>
                    <strong>Status:</strong>{" "}
                    <StatusBadge status={item.status} />
                </p>

                {showAccept && (
                    <button
                        type="button"
                        disabled={loading}
                        onClick={() => acceptRide(item.id)}
                    >
                        {loading ? "Please wait..." : "Accept Ride"}
                    </button>
                )}

                {!showAccept && item.status === "ACCEPTED" && (
                    <button
                        type="button"
                        disabled={loading}
                        onClick={() =>
                            updateRideStatus(item.id, "IN_PROGRESS")
                        }
                    >
                        Start Ride
                    </button>
                )}

                {!showAccept && item.status === "IN_PROGRESS" && (
                    <button
                        type="button"
                        disabled={loading}
                        onClick={() =>
                            updateRideStatus(item.id, "COMPLETED")
                        }
                    >
                        Complete Ride
                    </button>
                )}
            </article>
        );
    }

    // Keep the latest dashboard loaders available to WebSocket callbacks without
    // reconnecting the socket on every render.
    const riderHistoryLoaderRef = useRef(loadRiderHistory);
    const driverRidesLoaderRef = useRef(loadDriverRides);
    const adminDashboardLoaderRef = useRef(loadAdminDashboard);
    const riderHistoryRef = useRef(riderHistory);
    const activeDriverRidesRef = useRef([]);

    riderHistoryRef.current = riderHistory;
    activeDriverRidesRef.current = driverRides.filter((item) =>
        ["ACCEPTED", "IN_PROGRESS"].includes(String(item.status || "").toUpperCase())
    );
    riderHistoryLoaderRef.current = loadRiderHistory;
    driverRidesLoaderRef.current = loadDriverRides;
    adminDashboardLoaderRef.current = loadAdminDashboard;

    // Real-time ride events. The backend uses a native WebSocket STOMP endpoint
    // (/ws), so brokerURL is used instead of SockJS.
    useEffect(() => {
        if (!token || !role) {
            setWebSocketConnected(false);
            return undefined;
        }

        let disposed = false;
        const client = new Client({

            brokerURL: import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws",

            connectHeaders: {
                Authorization: `Bearer ${token}`,
            },
            reconnectDelay: 5000,
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,
            onConnect: () => {
                if (disposed) return;
                setWebSocketConnected(true);

                // Private events are delivered through Spring's user destination.
                client.subscribe("/user/queue/rides", (frame) => {
                    if (disposed) return;
                    let event;
                    try {
                        event = JSON.parse(frame.body);
                    } catch {
                        return;
                    }
                    if (!event || !event.type) return;

                    // GPS updates are deliberately handled separately so a location
                    // ping does not create a notification or reload the ride history.
                    if (event.type === "DRIVER_LOCATION_UPDATE") {
                        if (role === "USER") {
                            const matchingRide = riderHistoryRef.current.find(
                                (item) => String(item.id ?? item.rideId) === String(event.rideId)
                            );
                            const latitude = Number(event.latitude);
                            const longitude = Number(event.longitude);
                            if (
                                matchingRide &&
                                ["ACCEPTED", "IN_PROGRESS"].includes(String(matchingRide.status || "").toUpperCase()) &&
                                Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
                                Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
                            ) {
                                setTrackedDriverLocation({
                                    rideId: event.rideId,
                                    position: [latitude, longitude],
                                    updatedAt: new Date().toLocaleTimeString(),
                                });
                            }
                        }
                        return;
                    }

                    if (role === "USER") {
                        const status = String(event.status || "").toUpperCase();
                        const rideNumber = event.rideId ?? "—";
                        const driverName = event.driverName || event.driverFullName || event.driver?.name || event.driver?.fullName || "";
                        const driverPhone = event.driverPhone || event.driver?.phone || "";
                        let notificationText = "";

                        if (event.type === "RIDE_CREATED") {
                            notificationText = `Your ride #${rideNumber} has been booked successfully.`;
                        } else if (event.type === "RIDE_ACCEPTED") {
                            notificationText = `A driver has accepted your ride #${rideNumber}.`;
                        } else if (event.type === "RIDE_STATUS_CHANGED") {
                            if (status === "IN_PROGRESS") {
                                notificationText = `Your ride #${rideNumber} has started. Have a safe journey!`;
                            } else if (status === "COMPLETED") {
                                notificationText = `Your ride #${rideNumber} is completed. Thank you for riding with us!`;
                            } else {
                                notificationText = `Your ride #${rideNumber} status is now ${String(event.status || "updated").replaceAll("_", " ").toLowerCase()}.`;
                            }
                        }

                        if (notificationText) {
                            setNotifications((previous) => [
                                {
                                    id: `${rideNumber}-${event.type}-${status}-${Date.now()}`,
                                    rideId: event.rideId,
                                    text: notificationText,
                                    type: event.type,
                                    status,
                                    driverName,
                                    driverPhone,
                                    createdAt: new Date().toLocaleTimeString(),
                                },
                                ...previous,
                            ].slice(0, 10));
                        }

                        void riderHistoryLoaderRef.current(token);
                    } else if (role === "DRIVER") {
                        void driverRidesLoaderRef.current(token);
                    } else if (role === "ADMIN") {
                        void adminDashboardLoaderRef.current(token);
                    }
                });

                // Only drivers/admins should be allowed by the backend interceptor
                // to subscribe to this topic. It carries availability event IDs only.
                if (role === "DRIVER" || role === "ADMIN") {
                    client.subscribe("/topic/ride-availability", () => {
                        if (disposed) return;
                        if (role === "DRIVER") {
                            void driverRidesLoaderRef.current(token);
                        } else {
                            void adminDashboardLoaderRef.current(token);
                        }
                    });
                }
            },
            onWebSocketClose: () => {
                if (!disposed) setWebSocketConnected(false);
            },
            onWebSocketError: () => {
                if (!disposed) setWebSocketConnected(false);
            },
            onStompError: () => {
                if (!disposed) setWebSocketConnected(false);
            },
        });

        client.activate();

        return () => {
            disposed = true;
            setWebSocketConnected(false);
            void client.deactivate();
        };
    }, [token, role]);

    // Share the driver's GPS position only while an assigned ride is active.
    // Browser permission is required; location updates are throttled to one per ride every 5 seconds.
    useEffect(() => {
        if (!token || role !== "DRIVER" || !navigator.geolocation) {
            return undefined;
        }

        let disposed = false;
        const watchId = navigator.geolocation.watchPosition(
            async (position) => {
                if (disposed) return;
                const activeRides = activeDriverRidesRef.current;
                if (!activeRides.length) return;

                const now = Date.now();
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                for (const activeRide of activeRides) {
                    const rideId = activeRide.id ?? activeRide.rideId;
                    if (rideId == null || now - (lastGpsSentAtRef.current[rideId] || 0) < 5000) {
                        continue;
                    }
                    // Throttle before sending to avoid overlapping requests for the same ride.
                    lastGpsSentAtRef.current[rideId] = now;
                    try {
                        await apiRequest(`/rides/${rideId}/location`, token, {
                            method: "POST",
                            body: JSON.stringify({ latitude, longitude }),
                        });
                    } catch (error) {
                        // Avoid repeated permission/network alerts; surface only in the console.
                        console.warn(`Unable to send GPS for ride ${rideId}:`, error.message);
                    }
                }
            },
            (error) => {
                if (!disposed) {
                    console.warn("Driver location permission/error:", error.message);
                }
            },
            { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
        );

        return () => {
            disposed = true;
            navigator.geolocation.clearWatch(watchId);
        };
    }, [token, role]);

    const filteredAdminPayments = adminPayments.filter((payment) => {
        const paymentRideId =
            payment.ride?.id ?? payment.rideId ?? payment.ride?.rideId ?? "";
        const paymentStatus = String(payment.paymentStatus || "UNKNOWN").toUpperCase();
        const paymentMethod = String(payment.paymentMethod || "UNKNOWN").toUpperCase();
        const search = paymentSearch.trim().toLowerCase();

        const matchesSearch =
            !search ||
            String(payment.id ?? "").toLowerCase().includes(search) ||
            String(paymentRideId).toLowerCase().includes(search) ||
            String(payment.razorpayPaymentId || "").toLowerCase().includes(search) ||
            paymentStatus.toLowerCase().includes(search) ||
            paymentMethod.toLowerCase().includes(search) ||
            String(payment.amount ?? "").toLowerCase().includes(search);

        const matchesStatus =
            paymentStatusFilter === "ALL" || paymentStatus === paymentStatusFilter;
        const matchesMethod =
            paymentMethodFilter === "ALL" || paymentMethod === paymentMethodFilter;

        return matchesSearch && matchesStatus && matchesMethod;
    });

    const completedDriverRides = driverRides.filter(
        (item) => String(item.status || "").toUpperCase() === "COMPLETED"
    );
    const activeDriverRides = driverRides.filter((item) =>
        ["ACCEPTED", "IN_PROGRESS"].includes(String(item.status || "").toUpperCase())
    );
    const driverTotalEarnings = completedDriverRides.reduce(
        (total, item) => total + (Number(item.fare) || 0),
        0
    );

    const navigationItems = role === "USER"
        ? [{ href: "#book-ride", icon: "⌖", label: "Book a Ride" }, { href: "#my-rides", icon: "▤", label: "My Rides" }]
        : role === "DRIVER"
            ? [{ href: "#driver-dashboard", icon: "▦", label: "Dashboard" }, { href: "#driver-rides", icon: "🚘", label: "My Rides" }]
            : role === "ADMIN"
                ? [{ href: "#admin-dashboard", icon: "▦", label: "Dashboard" }, { href: "#admin-users", icon: "♙", label: "Users" }, { href: "#admin-rides", icon: "⇄", label: "Rides" }, { href: "#admin-payments", icon: "▣", label: "Payments" }]
                : [];

    return (
        <main className={`cab-app ${token ? "is-authenticated" : "is-guest"}`}>
            {token && (
                <aside className="cab-sidebar">
                    <a className="cab-brand" href="#top"><span className="cab-brand-icon">🚕</span><span>Cab Booking<small>RIDE • SAFE • SIMPLE</small></span></a>
                    <div className="cab-nav-label">WORKSPACE</div>
                    <nav className="cab-nav">
                        {navigationItems.map((item, index) => (
                            <a key={item.href} className={index === 0 ? "active" : ""} href={item.href}><span className="cab-nav-icon">{item.icon}</span>{item.label}</a>
                        ))}
                    </nav>
                    <div className="cab-sidebar-footer"><span className="cab-online-dot" /> Service operational</div>
                </aside>
            )}
            <div className="cab-content" id="top">
                <header className="cab-topbar" style={{ marginBottom: 20 }}>
                    <h1>🚖 Cab Booking</h1>
                    <p>Book rides or manage driver requests.</p>
                    {token && (
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <span
                                title={webSocketConnected ? "Live ride updates connected" : "Live ride updates reconnecting"}
                                style={{ fontSize: 13, fontWeight: 700, color: webSocketConnected ? "#15803d" : "#b45309" }}
                            >
                                {webSocketConnected ? "● Live updates connected" : "● Live updates reconnecting"}
                            </span>
                            <div className="cab-account-chip"><span className="cab-avatar">{(email || "U").charAt(0).toUpperCase()}</span><span><strong>{email}</strong><small>{role}</small></span></div>
                        </div>
                    )}
                </header>

                {!token ? (
                    <form
                        onSubmit={login}
                        style={{
                            background: "white",
                            padding: 20,
                            borderRadius: 12,
                            marginBottom: 20,
                            display: "grid",
                            gap: 12,
                        }}
                    >
                        <h2>Login</h2>

                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            placeholder="Enter your registered email"
                            autoComplete="username"
                            required
                        />

                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            required
                        />

                        <button type="submit" disabled={loading}>
                            {loading ? "Please wait..." : "Log In"}
                        </button>
                    </form>
                ) : (
                    <section
                        style={{
                            background: "white",
                            padding: 16,
                            borderRadius: 12,
                            marginBottom: 20,
                        }}
                    >
                        <p>
                            Logged in as <strong>{email}</strong>
                        </p>

                        <p>
                            Account type: <strong>{role}</strong>
                        </p>

                        <button
                            type="button"
                            onClick={logout}
                            disabled={loading || payingRideId !== null}
                        >
                            Log Out
                        </button>
                    </section>
                )}

                {message && (
                    <p
                        role="status"
                        style={{
                            padding: 12,
                            background: "#eff6ff",
                            borderRadius: 8,
                            marginBottom: 16,
                            overflowWrap: "anywhere",
                        }}
                    >
                        {message}
                    </p>
                )}

                {token && role === "USER" && (
                    <>
                        <section
                            id="ride-notifications"
                            className="cab-panel"
                            aria-label="Ride notifications"
                            style={{
                                background: "white",
                                padding: 20,
                                borderRadius: 12,
                                marginBottom: 20,
                                border: "1px solid #e2e8f0",
                            }}
                        >
                            <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 12,
                                flexWrap: "wrap",
                            }}>
                                <h2 style={{ margin: 0 }}>🔔 Ride Notifications</h2>
                                {notifications.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setNotifications([])}
                                    >
                                        Clear Notifications
                                    </button>
                                )}
                            </div>

                            {notifications.length === 0 ? (
                                <p style={{ color: "#64748b", marginBottom: 0 }}>
                                    No new notifications. Ride updates will appear here automatically.
                                </p>
                            ) : (
                                <ul style={{
                                    listStyle: "none",
                                    padding: 0,
                                    margin: "14px 0 0",
                                    display: "grid",
                                    gap: 10,
                                }}>
                                    {notifications.map((notification) => (
                                        <li
                                            key={notification.id}
                                            style={{
                                                padding: 12,
                                                borderRadius: 8,
                                                background: notification.type === "RIDE_ACCEPTED" ? "#dcfce7" : "#eff6ff",
                                                border: "1px solid #e2e8f0",
                                            }}
                                        >
                                            <div style={{ fontWeight: 600 }}>
                                                {notification.text}
                                            </div>
                                            {notification.type === "RIDE_ACCEPTED" && (() => {
                                                const rideDetails = riderHistory.find(
                                                    (item) => String(item.id ?? item.rideId) === String(notification.rideId)
                                                );
                                                const name = notification.driverName || rideDetails?.driverName || rideDetails?.driver?.name;
                                                const phone = notification.driverPhone || rideDetails?.driverPhone || rideDetails?.driver?.phone;
                                                return (name || phone) ? (
                                                    <div style={{ marginTop: 7, color: "#166534", fontSize: 13 }}>
                                                        {name && <div>Driver: {name}</div>}
                                                        {phone && <div>Phone: {phone}</div>}
                                                    </div>
                                                ) : null;
                                            })()}
                                            <small style={{ display: "block", marginTop: 5, color: "#64748b" }}>
                                                {notification.createdAt}
                                            </small>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section id="my-rides" className="cab-panel"
                                 style={{
                                     background: "white",
                                     padding: 20,
                                     borderRadius: 12,
                                     marginBottom: 24,
                                 }}
                        >
                            <h2>📜 My Ride History</h2>

                            <p>
                                View your previous bookings and their latest
                                statuses.
                            </p>

                            <button
                                type="button"
                                onClick={() => loadRiderHistory()}
                                disabled={loadingHistory}
                            >
                                {loadingHistory
                                    ? "Refreshing..."
                                    : "Refresh Ride History"}
                            </button>

                            {loadingHistory ? (
                                <p>Loading your rides...</p>
                            ) : riderHistory.length === 0 ? (
                                <p>
                                    You haven't booked any rides yet.
                                    Your bookings will appear here.
                                </p>
                            ) : (
                                <div style={{ marginTop: 16 }}>
                                    {riderHistory.map((item) => (
                                        <article
                                            key={item.id}
                                            style={{
                                                border: "1px solid #ddd",
                                                borderRadius: 10,
                                                padding: 16,
                                                marginBottom: 12,
                                                background: "#fff",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    flexWrap: "wrap",
                                                    gap: 8,
                                                }}
                                            >
                                                <h3 style={{ margin: 0 }}>
                                                    Ride #{item.id}
                                                </h3>

                                                <StatusBadge
                                                    status={item.status}
                                                />
                                            </div>

                                            <p>
                                                <strong>Pickup:</strong>{" "}
                                                {formatLocation(
                                                    item.pickupLocation
                                                )}
                                            </p>

                                            {item.pickupAddress && (
                                                <p
                                                    style={{
                                                        color: "#555",
                                                        overflowWrap: "anywhere",
                                                    }}
                                                >
                                                    {item.pickupAddress}
                                                </p>
                                            )}

                                            <p>
                                                <strong>Destination:</strong>{" "}
                                                {formatLocation(
                                                    item.dropLocation
                                                )}
                                            </p>

                                            {item.dropAddress && (
                                                <p
                                                    style={{
                                                        color: "#555",
                                                        overflowWrap: "anywhere",
                                                    }}
                                                >
                                                    {item.dropAddress}
                                                </p>
                                            )}

                                            <p>
                                                <strong>Fare:</strong>{" "}
                                                {formatFare(item.fare)}
                                            </p>

                                            {/* Show payment status and avoid duplicate payment attempts. */}
                                            {item.status === "COMPLETED" && (() => {
                                                const payment = findPaymentForRide(
                                                    paymentHistory,
                                                    item.id
                                                );

                                                if (!paymentHistoryLoaded) {
                                                    return (
                                                        <p style={{ color: "#666" }}>
                                                            Checking payment status...
                                                        </p>
                                                    );
                                                }

                                                if (String(payment?.paymentStatus || "").toUpperCase() === "PAID") {
                                                    return (
                                                        <div style={{ marginTop: 8, marginBottom: 12 }}>
                                                            <p
                                                                style={{
                                                                    display: "inline-block",
                                                                    padding: "8px 12px",
                                                                    borderRadius: 20,
                                                                    background: "#dcfce7",
                                                                    color: "#166534",
                                                                    fontWeight: 700,
                                                                    margin: "0 0 10px",
                                                                }}
                                                            >
                                                                ✓ PAID
                                                            </p>
                                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => downloadReceipt(payment.id)}
                                                                    disabled={receiptAction !== ""}
                                                                    style={{ padding: "10px 14px" }}
                                                                >
                                                                    {receiptAction === `download-${payment.id}`
                                                                        ? "Downloading..."
                                                                        : "Download Receipt"}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => emailReceipt(payment.id)}
                                                                    disabled={receiptAction !== ""}
                                                                    style={{ padding: "10px 14px" }}
                                                                >
                                                                    {receiptAction === `email-${payment.id}`
                                                                        ? "Sending..."
                                                                        : "Email Receipt"}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                if (payment) {
                                                    return (
                                                        <p
                                                            style={{
                                                                display: "inline-block",
                                                                padding: "8px 12px",
                                                                borderRadius: 20,
                                                                background: "#fef3c7",
                                                                color: "#92400e",
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            PAYMENT {payment.paymentStatus || "PENDING"}
                                                        </p>
                                                    );
                                                }

                                                return (
                                                    <button
                                                        type="button"
                                                        onClick={() => payForRide(item.id)}
                                                        disabled={
                                                            payingRideId !== null ||
                                                            loading
                                                        }
                                                        style={{
                                                            marginTop: 8,
                                                            padding: 12,
                                                        }}
                                                    >
                                                        {payingRideId === item.id
                                                            ? "Processing..."
                                                            : `Pay Now — ${formatFare(item.fare)}`}
                                                    </button>
                                                );
                                            })()}

                                            {item.driver && (
                                                <p>
                                                    <strong>Driver:</strong>{" "}
                                                    {item.driver.name ||
                                                        item.driver.email ||
                                                        "Assigned"}
                                                </p>
                                            )}

                                            {String(item.status).toUpperCase() === "COMPLETED" && (
                                                <section
                                                    aria-label={`Rating for ride ${item.id}`}
                                                    style={{
                                                        marginTop: 16,
                                                        padding: 14,
                                                        borderRadius: 10,
                                                        background: "#f8fafc",
                                                        border: "1px solid #e2e8f0",
                                                    }}
                                                >
                                                    {rideRatings[item.id] ? (
                                                        <>
                                                            <h4 style={{ margin: "0 0 8px" }}>Your review</h4>
                                                            <p style={{ margin: "0 0 6px", color: "#d97706", fontSize: 22 }}>
                                                                {"★".repeat(Math.max(0, Math.min(5, Number(rideRatings[item.id].rating) || 0)))}
                                                                <span style={{ color: "#d1d5db" }}>
                                                                {"★".repeat(5 - Math.max(0, Math.min(5, Number(rideRatings[item.id].rating) || 0)))}
                                                            </span>
                                                                <span style={{ color: "#374151", fontSize: 14, marginLeft: 8 }}>
                                                                {rideRatings[item.id].rating}/5
                                                            </span>
                                                            </p>
                                                            {rideRatings[item.id].comment && (
                                                                <p style={{ margin: 0, overflowWrap: "anywhere" }}>
                                                                    {rideRatings[item.id].comment}
                                                                </p>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <h4 style={{ margin: "0 0 8px" }}>Rate your ride</h4>
                                                            <p style={{ margin: "0 0 8px", color: "#4b5563" }}>
                                                                How was your experience with this ride?
                                                            </p>
                                                            <div
                                                                role="group"
                                                                aria-label={`Choose rating for ride ${item.id}`}
                                                                style={{ display: "flex", gap: 4, marginBottom: 10 }}
                                                            >
                                                                {[1, 2, 3, 4, 5].map((score) => {
                                                                    const selected = Number(
                                                                        ratingDrafts[item.id]?.rating ?? 5
                                                                    ) >= score;
                                                                    return (
                                                                        <button
                                                                            key={score}
                                                                            type="button"
                                                                            aria-label={`${score} star${score === 1 ? "" : "s"}`}
                                                                            aria-pressed={Number(ratingDrafts[item.id]?.rating ?? 5) === score}
                                                                            onClick={() => setRatingDrafts((previous) => ({
                                                                                ...previous,
                                                                                [item.id]: {
                                                                                    ...(previous[item.id] || { comment: "" }),
                                                                                    rating: score,
                                                                                },
                                                                            }))}
                                                                            style={{
                                                                                border: 0,
                                                                                background: "transparent",
                                                                                padding: "2px 4px",
                                                                                cursor: "pointer",
                                                                                fontSize: 30,
                                                                                lineHeight: 1,
                                                                                color: selected ? "#f59e0b" : "#d1d5db",
                                                                            }}
                                                                        >
                                                                            ★
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                            <label
                                                                htmlFor={`rating-comment-${item.id}`}
                                                                style={{ display: "block", marginBottom: 6, fontWeight: 600 }}
                                                            >
                                                                Comment (optional)
                                                            </label>
                                                            <textarea
                                                                id={`rating-comment-${item.id}`}
                                                                value={ratingDrafts[item.id]?.comment ?? ""}
                                                                onChange={(event) => setRatingDrafts((previous) => ({
                                                                    ...previous,
                                                                    [item.id]: {
                                                                        ...(previous[item.id] || { rating: 5 }),
                                                                        comment: event.target.value.slice(0, 1000),
                                                                    },
                                                                }))}
                                                                maxLength={1000}
                                                                rows={3}
                                                                placeholder="Share your experience..."
                                                                style={{
                                                                    display: "block",
                                                                    width: "100%",
                                                                    boxSizing: "border-box",
                                                                    padding: 10,
                                                                    border: "1px solid #cbd5e1",
                                                                    borderRadius: 8,
                                                                    marginBottom: 10,
                                                                    font: "inherit",
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => submitRideRating(item.id)}
                                                                disabled={submittingRatingId !== null}
                                                                style={{ padding: "10px 14px" }}
                                                            >
                                                                {submittingRatingId === item.id ? "Submitting..." : "Submit Rating"}
                                                            </button>
                                                        </>
                                                    )}
                                                </section>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 12,
                                marginBottom: 16,
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setSelection("pickup")}
                                style={{
                                    padding: 12,
                                    borderRadius: 8,
                                    border:
                                        selection === "pickup"
                                            ? "2px solid green"
                                            : "1px solid #ccc",
                                    background: "white",
                                }}
                            >
                                Select Pickup
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelection("drop")}
                                style={{
                                    padding: 12,
                                    borderRadius: 8,
                                    border:
                                        selection === "drop"
                                            ? "2px solid red"
                                            : "1px solid #ccc",
                                    background: "white",
                                }}
                            >
                                Select Destination
                            </button>
                        </section>

                        <p>
                            Currently selecting:{" "}
                            <strong>
                                {selection === "pickup"
                                    ? "Pickup"
                                    : "Destination"}
                            </strong>
                        </p>

                        {role === "USER" && trackedDriverLocation && (
                            <p role="status" style={{ color: "#1d4ed8", fontWeight: 600 }}>
                                📍 Live driver tracking for Ride #{trackedDriverLocation.rideId}. Last update: {trackedDriverLocation.updatedAt}.
                            </p>
                        )}

                        <div
                            style={{
                                height: 480,
                                borderRadius: 12,
                                overflow: "hidden",
                                border: "1px solid #ddd",
                            }}
                        >
                            <MapContainer
                                center={defaultPosition}
                                zoom={12}
                                style={{
                                    height: "100%",
                                    width: "100%",
                                }}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />

                                <LocationSelector
                                    selection={selection}
                                    setPickup={changePickup}
                                    setDrop={changeDrop}
                                />

                                <FitRoute
                                    pickup={pickup}
                                    drop={drop}
                                    routeCoordinates={routeCoordinates}
                                />

                                <Marker
                                    position={pickup}
                                    icon={pickupIcon}
                                >
                                    <Popup>
                                        <strong>Pickup:</strong>{" "}
                                        {pickupPlace.name}
                                        <br />
                                        {pickupPlace.address}
                                    </Popup>
                                </Marker>

                                <Marker
                                    position={drop}
                                    icon={dropIcon}
                                >
                                    <Popup>
                                        <strong>Destination:</strong>{" "}
                                        {dropPlace.name}
                                        <br />
                                        {dropPlace.address}
                                    </Popup>
                                </Marker>

                                {role === "USER" && trackedDriverLocation && (
                                    <Marker
                                        position={trackedDriverLocation.position}
                                        icon={driverIcon}
                                    >
                                        <Popup>
                                            <strong>Driver's live location</strong>
                                            <br />
                                            Ride #{trackedDriverLocation.rideId}
                                            <br />
                                            Updated: {trackedDriverLocation.updatedAt}
                                        </Popup>
                                    </Marker>
                                )}

                                {routeCoordinates.length > 1 && (
                                    <Polyline
                                        positions={routeCoordinates}
                                        pathOptions={{
                                            color: "#2563eb",
                                            weight: 5,
                                            opacity: 0.85,
                                        }}
                                    />
                                )}
                            </MapContainer>
                        </div>

                        <section id="book-ride" className="cab-panel"
                                 style={{
                                     marginTop: 20,
                                     background: "white",
                                     padding: 20,
                                     borderRadius: 12,
                                 }}
                        >
                            <h2>Ride Details</h2>

                            <p>
                                <strong>Pickup:</strong>{" "}
                                {resolvingPickup
                                    ? "Finding pickup address..."
                                    : pickupPlace.name}
                            </p>

                            {pickupPlace.address && (
                                <p
                                    style={{
                                        color: "#555",
                                        overflowWrap: "anywhere",
                                    }}
                                >
                                    {pickupPlace.address}
                                </p>
                            )}

                            <p>
                                <strong>Destination:</strong>{" "}
                                {resolvingDrop
                                    ? "Finding destination address..."
                                    : dropPlace.name}
                            </p>

                            {dropPlace.address && (
                                <p
                                    style={{
                                        color: "#555",
                                        overflowWrap: "anywhere",
                                    }}
                                >
                                    {dropPlace.address}
                                </p>
                            )}

                            <p style={{ fontSize: 13, color: "#666" }}>
                                Pickup coordinates:{" "}
                                {pickup[0].toFixed(6)},{" "}
                                {pickup[1].toFixed(6)}
                            </p>

                            <p style={{ fontSize: 13, color: "#666" }}>
                                Destination coordinates:{" "}
                                {drop[0].toFixed(6)},{" "}
                                {drop[1].toFixed(6)}
                            </p>

                            <button
                                type="button"
                                onClick={calculateFare}
                                disabled={
                                    calculating ||
                                    loading ||
                                    resolvingPickup ||
                                    resolvingDrop
                                }
                                style={{ marginTop: 12, padding: 12 }}
                            >
                                {calculating
                                    ? "Calculating route..."
                                    : "Calculate Fare"}
                            </button>

                            {routeEstimate && (
                                <div
                                    style={{
                                        marginTop: 20,
                                        padding: 16,
                                        borderRadius: 10,
                                        background: "#f0fdf4",
                                    }}
                                >
                                    <h3>Route Estimate</h3>

                                    <p>
                                        <strong>Driving distance:</strong>{" "}
                                        {routeEstimate.distanceKm} km
                                    </p>

                                    <p>
                                        <strong>Estimated time:</strong>{" "}
                                        {routeEstimate.etaMinutes} minutes
                                    </p>

                                    <p>
                                        <strong>Estimated fare:</strong>{" "}
                                        {formatFare(
                                            routeEstimate.estimatedFare
                                        )}
                                    </p>

                                    {routeCoordinates.length > 1 && (
                                        <p>
                                            Driving route displayed on the map.
                                        </p>
                                    )}

                                    <button
                                        type="button"
                                        onClick={bookRide}
                                        disabled={
                                            loading ||
                                            resolvingPickup ||
                                            resolvingDrop
                                        }
                                        style={{
                                            marginTop: 12,
                                            padding: 12,
                                        }}
                                    >
                                        {loading
                                            ? "Booking..."
                                            : "Book Ride"}
                                    </button>
                                </div>
                            )}

                            {ride && (
                                <div>
                                    <h3>Booking Confirmation</h3>

                                    <p>Ride ID: {ride.id}</p>

                                    <p>
                                        Status:{" "}
                                        <StatusBadge status={ride.status} />
                                    </p>

                                    <p>
                                        Pickup:{" "}
                                        {formatLocation(ride.pickupLocation)}
                                    </p>

                                    {ride.pickupAddress && (
                                        <p>{ride.pickupAddress}</p>
                                    )}

                                    <p>
                                        Destination:{" "}
                                        {formatLocation(ride.dropLocation)}
                                    </p>

                                    {ride.dropAddress && (
                                        <p>{ride.dropAddress}</p>
                                    )}

                                    <p>Fare: {formatFare(ride.fare)}</p>
                                </div>
                            )}
                        </section>
                    </>
                )}

                {token && role === "DRIVER" && (
                    <section id="driver-dashboard" className="cab-panel">
                        <h2>🚘 Driver Dashboard</h2>

                        <button
                            type="button"
                            onClick={() => loadDriverRides()}
                            disabled={refreshingRides || loading}
                        >
                            {refreshingRides
                                ? "Refreshing..."
                                : "Refresh Rides"}
                        </button>

                        <div className="cab-driver-stats" aria-label="Driver statistics">
                            <article className="cab-driver-stat">
                                <span className="cab-driver-stat-icon">🕒</span>
                                <span className="cab-driver-stat-label">Pending Requests</span>
                                <strong>{pendingRides.length}</strong>
                            </article>
                            <article className="cab-driver-stat">
                                <span className="cab-driver-stat-icon">🚘</span>
                                <span className="cab-driver-stat-label">Active Rides</span>
                                <strong>{activeDriverRides.length}</strong>
                            </article>
                            <article className="cab-driver-stat">
                                <span className="cab-driver-stat-icon">✅</span>
                                <span className="cab-driver-stat-label">Completed Rides</span>
                                <strong>{completedDriverRides.length}</strong>
                            </article>
                            <article className="cab-driver-stat">
                                <span className="cab-driver-stat-icon">₹</span>
                                <span className="cab-driver-stat-label">Completed Fare Total</span>
                                <strong>{formatFare(driverTotalEarnings)}</strong>
                            </article>
                        </div>

                        <section className="cab-driver-reviews" aria-label="Driver ratings and reviews">
                            <div className="cab-driver-reviews-heading">
                                <div>
                                    <h3>⭐ My Ratings & Reviews</h3>
                                    <p>Customer feedback for your completed rides.</p>
                                </div>
                                <div className="cab-driver-rating-score">
                                    <strong>{Number(driverRatingSummary?.averageRating ?? 0).toFixed(1)}</strong>
                                    <span>/ 5</span>
                                    <small>{driverRatingSummary?.totalReviews ?? 0} reviews</small>
                                </div>
                            </div>
                            {driverReviews.length === 0 ? (
                                <p className="cab-driver-empty-reviews">
                                    No customer reviews are available yet. Reviews will appear here after riders rate completed rides.
                                </p>
                            ) : (
                                <div className="cab-driver-review-list">
                                    {driverReviews.slice(0, 5).map((review) => (
                                        <article className="cab-driver-review" key={review.id ?? review.ride?.id}>
                                            <div className="cab-driver-review-stars" aria-label={`${review.rating ?? 0} out of 5 stars`}>
                                                {"★".repeat(Math.max(0, Math.min(5, Number(review.rating) || 0)))}
                                                <span>{` ${review.rating ?? 0}/5`}</span>
                                            </div>
                                            <p>{review.comment?.trim() || "No written comment provided."}</p>
                                            <small>Ride #{review.ride?.id ?? review.rideId ?? "—"}</small>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>

                        <h3 style={{ marginTop: 24 }}>
                            Pending Ride Requests
                        </h3>

                        {pendingRides.length === 0 ? (
                            <p>
                                No pending rides are currently available.
                            </p>
                        ) : (
                            pendingRides.map((item) =>
                                renderDriverRideCard(item, true)
                            )
                        )}

                        <h3 id="driver-rides" style={{ marginTop: 24 }}>
                            My Assigned Rides
                        </h3>

                        {driverRides.length === 0 ? (
                            <p>You have no assigned rides yet.</p>
                        ) : (
                            driverRides.map((item) =>
                                renderDriverRideCard(item)
                            )
                        )}
                    </section>
                )}

                {token && role === "ADMIN" && (
                    <section id="admin-dashboard" className="cab-panel" style={{ marginTop: 24 }}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 12,
                                marginBottom: 20,
                            }}
                        >
                            <div>
                                <h2>🛡️ Admin Dashboard</h2>
                                <p>Manage users, drivers, and all ride bookings.</p>
                            </div>

                            <button
                                type="button"
                                onClick={() => loadAdminDashboard()}
                                disabled={loadingAdmin}
                                style={{ padding: "10px 16px" }}
                            >
                                {loadingAdmin ? "Refreshing..." : "Refresh Dashboard"}
                            </button>
                        </div>

                        {loadingAdmin && !adminStats ? (
                            <p>Loading dashboard data...</p>
                        ) : adminStats ? (
                            <>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns:
                                            "repeat(auto-fit, minmax(170px, 1fr))",
                                        gap: 16,
                                        marginBottom: 28,
                                    }}
                                >
                                    {[
                                        {
                                            label: "Total Users",
                                            value: adminStats.totalUsers,
                                            color: "#2563eb",
                                            icon: "👥",
                                        },
                                        {
                                            label: "Total Drivers",
                                            value: adminStats.totalDrivers,
                                            color: "#7c3aed",
                                            icon: "🚘",
                                        },
                                        {
                                            label: "Total Rides",
                                            value: adminStats.totalRides,
                                            color: "#0891b2",
                                            icon: "🛣️",
                                        },
                                        {
                                            label: "Pending Rides",
                                            value: adminStats.pendingRides,
                                            color: "#d97706",
                                            icon: "⏳",
                                        },
                                        {
                                            label: "In Progress",
                                            value: adminStats.inProgressRides,
                                            color: "#7c3aed",
                                            icon: "🚕",
                                        },
                                        {
                                            label: "Completed Rides",
                                            value: adminStats.completedRides,
                                            color: "#16a34a",
                                            icon: "✅",
                                        },
                                    ].map((stat) => (
                                        <article
                                            key={stat.label}
                                            style={{
                                                background: "white",
                                                border: "1px solid #e5e7eb",
                                                borderRadius: 12,
                                                padding: 20,
                                                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                                            }}
                                        >
                                            <div style={{ fontSize: 26 }}>
                                                {stat.icon}
                                            </div>

                                            <p
                                                style={{
                                                    color: "#6b7280",
                                                    marginBottom: 6,
                                                }}
                                            >
                                                {stat.label}
                                            </p>

                                            <strong
                                                style={{
                                                    fontSize: 30,
                                                    color: stat.color,
                                                }}
                                            >
                                                {stat.value ?? 0}
                                            </strong>
                                        </article>
                                    ))}
                                </div>

                                <section
                                    style={{
                                        background: "white",
                                        padding: 20,
                                        borderRadius: 12,
                                        marginBottom: 24,
                                        border: "1px solid #e5e7eb",
                                    }}
                                >
                                    <h2 id="admin-users">👥 Registered Users</h2>
                                    <p>Total records: {adminUsers.length}</p>

                                    <div style={{ overflowX: "auto" }}>
                                        <table
                                            style={{
                                                width: "100%",
                                                borderCollapse: "collapse",
                                                minWidth: 600,
                                                textAlign: "left",
                                            }}
                                        >
                                            <thead>
                                            <tr style={{ background: "#f3f4f6" }}>
                                                {[
                                                    "ID",
                                                    "Name",
                                                    "Email",
                                                    "Phone",
                                                    "Role",
                                                ].map((heading) => (
                                                    <th
                                                        key={heading}
                                                        style={{
                                                            padding: 12,
                                                            borderBottom: "1px solid #ddd",
                                                        }}
                                                    >
                                                        {heading}
                                                    </th>
                                                ))}
                                            </tr>
                                            </thead>

                                            <tbody>
                                            {adminUsers.map((user) => (
                                                <tr key={user.id}>
                                                    <td style={{ padding: 12 }}>
                                                        {user.id}
                                                    </td>
                                                    <td style={{ padding: 12 }}>
                                                        {user.name}
                                                    </td>
                                                    <td style={{ padding: 12 }}>
                                                        {user.email}
                                                    </td>
                                                    <td style={{ padding: 12 }}>
                                                        {user.phone || "—"}
                                                    </td>
                                                    <td style={{ padding: 12 }}>
                                            <span
                                                style={{
                                                    padding: "4px 8px",
                                                    borderRadius: 12,
                                                    background:
                                                        user.role === "ADMIN"
                                                            ? "#ede9fe"
                                                            : user.role === "DRIVER"
                                                                ? "#dbeafe"
                                                                : "#dcfce7",
                                                    color:
                                                        user.role === "ADMIN"
                                                            ? "#6d28d9"
                                                            : user.role === "DRIVER"
                                                                ? "#1d4ed8"
                                                                : "#166534",
                                                    fontWeight: 600,
                                                    fontSize: 12,
                                                }}
                                            >
                                                {user.role}
                                            </span>
                                                    </td>
                                                </tr>
                                            ))}

                                            {adminUsers.length === 0 && (
                                                <tr>
                                                    <td
                                                        colSpan={5}
                                                        style={{ padding: 16 }}
                                                    >
                                                        No users found.
                                                    </td>
                                                </tr>
                                            )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>

                                <section
                                    style={{
                                        background: "white",
                                        padding: 20,
                                        borderRadius: 12,
                                        marginBottom: 24,
                                        border: "1px solid #e5e7eb",
                                    }}
                                >
                                    <h2 id="admin-rides">🚖 All Ride Bookings</h2>
                                    <p>Total records: {adminRides.length}</p>

                                    <div style={{ overflowX: "auto" }}>
                                        <table
                                            style={{
                                                width: "100%",
                                                borderCollapse: "collapse",
                                                minWidth: 850,
                                                textAlign: "left",
                                            }}
                                        >
                                            <thead>
                                            <tr style={{ background: "#f3f4f6" }}>
                                                {[
                                                    "Ride ID",
                                                    "Rider",
                                                    "Pickup",
                                                    "Destination",
                                                    "Fare",
                                                    "Driver",
                                                    "Status",
                                                ].map((heading) => (
                                                    <th
                                                        key={heading}
                                                        style={{
                                                            padding: 12,
                                                            borderBottom: "1px solid #ddd",
                                                        }}
                                                    >
                                                        {heading}
                                                    </th>
                                                ))}
                                            </tr>
                                            </thead>

                                            <tbody>
                                            {adminRides.map((item) => (
                                                <tr key={item.id}>
                                                    <td style={{ padding: 12 }}>
                                                        #{item.id}
                                                    </td>

                                                    <td style={{ padding: 12 }}>
                                                        <strong>
                                                            {item.riderName || "Unknown"}
                                                        </strong>
                                                        <div
                                                            style={{
                                                                color: "#6b7280",
                                                                fontSize: 12,
                                                            }}
                                                        >
                                                            {item.riderEmail || "—"}
                                                        </div>
                                                    </td>

                                                    <td
                                                        style={{
                                                            padding: 12,
                                                            minWidth: 150,
                                                        }}
                                                    >
                                                        {item.pickupLocation || "—"}
                                                        {item.pickupAddress && (
                                                            <div
                                                                style={{
                                                                    color: "#6b7280",
                                                                    fontSize: 12,
                                                                    maxWidth: 220,
                                                                }}
                                                            >
                                                                {item.pickupAddress}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td
                                                        style={{
                                                            padding: 12,
                                                            minWidth: 150,
                                                        }}
                                                    >
                                                        {item.dropLocation || "—"}
                                                        {item.dropAddress && (
                                                            <div
                                                                style={{
                                                                    color: "#6b7280",
                                                                    fontSize: 12,
                                                                    maxWidth: 220,
                                                                }}
                                                            >
                                                                {item.dropAddress}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td style={{ padding: 12 }}>
                                                        {formatFare(item.fare)}
                                                    </td>

                                                    <td style={{ padding: 12 }}>
                                                        {item.driverName || "Unassigned"}
                                                    </td>

                                                    <td style={{ padding: 12 }}>
                                                        <StatusBadge
                                                            status={item.status}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}

                                            {adminRides.length === 0 && (
                                                <tr>
                                                    <td
                                                        colSpan={7}
                                                        style={{ padding: 16 }}
                                                    >
                                                        No rides found.
                                                    </td>
                                                </tr>
                                            )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>

                                <section
                                    style={{
                                        background: "white",
                                        padding: 20,
                                        borderRadius: 12,
                                        marginBottom: 24,
                                        border: "1px solid #e5e7eb",
                                    }}
                                >
                                    <h2 id="admin-payments">💳 All Payments</h2>
                                    <p>
                                        Showing {filteredAdminPayments.length} of {adminPayments.length} payment records
                                    </p>

                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                                            gap: 12,
                                            marginBottom: 16,
                                        }}
                                    >
                                        <input
                                            type="search"
                                            value={paymentSearch}
                                            onChange={(event) => setPaymentSearch(event.target.value)}
                                            placeholder="Search payment ID, ride ID, amount, status..."
                                            aria-label="Search payments"
                                            style={{
                                                width: "100%",
                                                boxSizing: "border-box",
                                                padding: "10px 12px",
                                                border: "1px solid #d1d5db",
                                                borderRadius: 8,
                                            }}
                                        />
                                        <select
                                            value={paymentStatusFilter}
                                            onChange={(event) => setPaymentStatusFilter(event.target.value)}
                                            aria-label="Filter payments by status"
                                            style={{
                                                width: "100%",
                                                padding: "10px 12px",
                                                border: "1px solid #d1d5db",
                                                borderRadius: 8,
                                                background: "white",
                                            }}
                                        >
                                            <option value="ALL">All statuses</option>
                                            <option value="PENDING">Pending</option>
                                            <option value="PAID">Paid</option>
                                            <option value="FAILED">Failed</option>
                                        </select>
                                        <select
                                            value={paymentMethodFilter}
                                            onChange={(event) => setPaymentMethodFilter(event.target.value)}
                                            aria-label="Filter payments by method"
                                            style={{
                                                width: "100%",
                                                padding: "10px 12px",
                                                border: "1px solid #d1d5db",
                                                borderRadius: 8,
                                                background: "white",
                                            }}
                                        >
                                            <option value="ALL">All methods</option>
                                            <option value="CASH">Cash</option>
                                            <option value="CARD">Card</option>
                                            <option value="UPI">UPI</option>
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPaymentSearch("");
                                                setPaymentStatusFilter("ALL");
                                                setPaymentMethodFilter("ALL");
                                            }}
                                            style={{ padding: "10px 12px" }}
                                        >
                                            Clear Filters
                                        </button>
                                    </div>

                                    <div style={{ overflowX: "auto" }}>
                                        <table
                                            style={{
                                                width: "100%",
                                                borderCollapse: "collapse",
                                                minWidth: 800,
                                                textAlign: "left",
                                            }}
                                        >
                                            <thead>
                                            <tr style={{ background: "#f3f4f6" }}>
                                                {["Payment ID", "Ride ID", "Amount", "Method", "Status", "Razorpay Payment ID"].map((heading) => (
                                                    <th
                                                        key={heading}
                                                        style={{
                                                            padding: 12,
                                                            borderBottom: "1px solid #ddd",
                                                        }}
                                                    >
                                                        {heading}
                                                    </th>
                                                ))}
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {filteredAdminPayments.map((payment) => {
                                                const paymentRideId =
                                                    payment.ride?.id ??
                                                    payment.rideId ??
                                                    payment.ride?.rideId;
                                                const paymentStatus = String(
                                                    payment.paymentStatus || "UNKNOWN"
                                                ).toUpperCase();
                                                const paid = paymentStatus === "PAID";

                                                return (
                                                    <tr key={payment.id}>
                                                        <td style={{ padding: 12 }}>#{payment.id}</td>
                                                        <td style={{ padding: 12 }}>
                                                            {paymentRideId != null ? `#${paymentRideId}` : "—"}
                                                        </td>
                                                        <td style={{ padding: 12 }}>
                                                            {formatFare(payment.amount)}
                                                        </td>
                                                        <td style={{ padding: 12 }}>
                                                            {payment.paymentMethod || "—"}
                                                        </td>
                                                        <td style={{ padding: 12 }}>
                                                            <span
                                                                style={{
                                                                    display: "inline-block",
                                                                    padding: "5px 9px",
                                                                    borderRadius: 20,
                                                                    fontSize: 12,
                                                                    fontWeight: 700,
                                                                    background: paid ? "#dcfce7" : paymentStatus === "FAILED" ? "#fee2e2" : "#fef3c7",
                                                                    color: paid ? "#166534" : paymentStatus === "FAILED" ? "#991b1b" : "#92400e",
                                                                }}
                                                            >
                                                                {paymentStatus}
                                                            </span>
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: 12,
                                                                fontSize: 12,
                                                                overflowWrap: "anywhere",
                                                                maxWidth: 220,
                                                            }}
                                                        >
                                                            {payment.razorpayPaymentId || "—"}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {filteredAdminPayments.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} style={{ padding: 16 }}>
                                                        {adminPayments.length === 0
                                                            ? "No payment records found."
                                                            : "No payments match your search or filters."}
                                                    </td>
                                                </tr>
                                            )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            </>
                        ) : (
                            <p>
                                Dashboard data is not available. Click Refresh Dashboard
                                to try again.
                            </p>
                        )}
                    </section>
                )}
            </div>
        </main>
    );
}

