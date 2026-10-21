
package com.rishubarman.cabbooking.controller;

import com.rishubarman.cabbooking.entity.Payment;
import com.rishubarman.cabbooking.service.PaymentService;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping
    @PreAuthorize("hasRole('USER')")
    public Payment createPayment(
            @Valid @RequestBody Payment payment,
            Authentication authentication) {

        return paymentService.createPayment(
                payment, authentication.getName());
    }

    @PostMapping("/razorpay/order")
    @PreAuthorize("hasRole('USER')")
    public Map<String, Object> createRazorpayOrder(
            @RequestBody Map<String, Long> request,
            Authentication authentication) {

        Long rideId = request.get("rideId");

        if (rideId == null) {
            throw new IllegalArgumentException("Ride ID is required");
        }

        Payment payment = paymentService.createRazorpayOrder(
                rideId, authentication.getName());

        return Map.of(
                "paymentId", payment.getId(),
                "orderId", payment.getRazorpayOrderId(),
                "amount", Math.round(payment.getAmount() * 100),
                "currency", "INR",
                "keyId", paymentService.getRazorpayKeyId()
        );
    }

    @PostMapping("/razorpay/verify")
    @PreAuthorize("hasRole('USER')")
    public Payment verifyRazorpayPayment(
            @RequestBody Map<String, Object> request,
            Authentication authentication) {

        if (request.get("paymentId") == null) {
            throw new IllegalArgumentException("Payment ID is required");
        }

        Long paymentId =
                Long.valueOf(request.get("paymentId").toString());

        return paymentService.verifyRazorpayPayment(
                paymentId,
                authentication.getName(),
                (String) request.get("razorpay_order_id"),
                (String) request.get("razorpay_payment_id"),
                (String) request.get("razorpay_signature")
        );
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<Payment> getAllPayments() {
        return paymentService.getAllPayments();
    }

    @GetMapping("/my-payments")
    @PreAuthorize("hasRole('USER')")
    public List<Payment> getMyPayments(
            Authentication authentication) {

        return paymentService.getMyPayments(
                authentication.getName());
    }

    // Download a PDF receipt for a confirmed payment.
    @GetMapping("/my-payments/{paymentId}/invoice")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<byte[]> downloadInvoice(
            @PathVariable Long paymentId,
            Authentication authentication) {

        byte[] pdf = paymentService.generateInvoicePdf(
                paymentId, authentication.getName());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);

        headers.setContentDisposition(
                ContentDisposition.attachment()
                        .filename(
                                "cab-booking-receipt-" + paymentId + ".pdf",
                                StandardCharsets.UTF_8)
                        .build());

        return ResponseEntity.ok()
                .headers(headers)
                .contentLength(pdf.length)
                .body(pdf);
    }

    // Email a PDF receipt to the authenticated rider.
    @PostMapping("/my-payments/{paymentId}/email-receipt")
    @PreAuthorize("hasRole('USER')")
    public Map<String, String> emailReceipt(
            @PathVariable Long paymentId,
            Authentication authentication) {

        paymentService.emailReceipt(
                paymentId, authentication.getName());

        return Map.of(
                "message", "Receipt emailed successfully");
    }
}
