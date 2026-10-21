
package com.rishubarman.cabbooking.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Entity
@Table(name = "payments")
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Double amount;

    @NotBlank(message = "Payment method is required")
    @Pattern(
            regexp = "CASH|CARD|UPI",
            message = "Payment method must be CASH, CARD, or UPI"
    )
    private String paymentMethod;

    @Pattern(
            regexp = "PENDING|PAID|FAILED",
            message = "Payment status must be PENDING, PAID, or FAILED"
    )
    private String paymentStatus;

    @Column(unique = true)
    private String razorpayOrderId;

    private String razorpayPaymentId;

    @OneToOne
    @JoinColumn(name = "ride_id", unique = true)
    private Ride ride;

    public Payment() {
    }

    public Long getId() {
        return id;
    }

    public Double getAmount() {
        return amount;
    }

    public void setAmount(Double amount) {
        this.amount = amount;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public String getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(String paymentStatus) {
        this.paymentStatus = paymentStatus;
    }

    public String getRazorpayOrderId() {
        return razorpayOrderId;
    }

    public void setRazorpayOrderId(String razorpayOrderId) {
        this.razorpayOrderId = razorpayOrderId;
    }

    public String getRazorpayPaymentId() {
        return razorpayPaymentId;
    }

    public void setRazorpayPaymentId(String razorpayPaymentId) {
        this.razorpayPaymentId = razorpayPaymentId;
    }

    public Ride getRide() {
        return ride;
    }

    public void setRide(Ride ride) {
        this.ride = ride;
    }
}
