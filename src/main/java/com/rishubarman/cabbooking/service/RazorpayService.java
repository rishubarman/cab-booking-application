
package com.rishubarman.cabbooking.service;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class RazorpayService {

    private final RazorpayClient razorpayClient;

    public RazorpayService(
            @Value("${razorpay.key.id:}") String keyId,
            @Value("${razorpay.key.secret:}") String keySecret) {

        if (keyId.isBlank() || keySecret.isBlank()) {
            throw new IllegalStateException(
                    "Razorpay keys are missing. Configure RAZORPAY_KEY_ID "
                            + "and RAZORPAY_KEY_SECRET in IntelliJ."
            );
        }

        try {
            this.razorpayClient = new RazorpayClient(keyId, keySecret);
        } catch (Exception e) {
            throw new IllegalStateException(
                    "Could not initialize Razorpay client.", e
            );
        }
    }

    public String createOrder(Double amountInRupees, Long paymentId) {
        if (amountInRupees == null || amountInRupees <= 0) {
            throw new IllegalArgumentException(
                    "Payment amount must be greater than zero."
            );
        }

        try {
            // Razorpay expects the amount in paise.
            long amountInPaise = Math.round(amountInRupees * 100);

            JSONObject orderRequest = new JSONObject();
            orderRequest.put("amount", amountInPaise);
            orderRequest.put("currency", "INR");
            orderRequest.put("receipt", "payment_" + paymentId);

            Order order = razorpayClient.orders.create(orderRequest);

            return order.get("id");
        } catch (Exception e) {
            throw new IllegalStateException(
                    "Failed to create Razorpay order.", e
            );
        }
    }
}
