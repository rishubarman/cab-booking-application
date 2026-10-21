
package com.rishubarman.cabbooking.service;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.razorpay.Utils;
import com.rishubarman.cabbooking.entity.Payment;
import com.rishubarman.cabbooking.entity.Ride;
import com.rishubarman.cabbooking.entity.User;
import com.rishubarman.cabbooking.repository.PaymentRepository;
import com.rishubarman.cabbooking.repository.RideRepository;
import com.rishubarman.cabbooking.repository.UserRepository;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Locale;

@Service
public class PaymentService {

    private static final Logger log =
            LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRepository paymentRepository;
    private final RideRepository rideRepository;
    private final UserRepository userRepository;
    private final RazorpayService razorpayService;
    private final JavaMailSender mailSender;
    private final String razorpayKeyId;
    private final String razorpayKeySecret;
    private final String mailFrom;

    public PaymentService(
            PaymentRepository paymentRepository,
            RideRepository rideRepository,
            UserRepository userRepository,
            RazorpayService razorpayService,
            JavaMailSender mailSender,
            @Value("${razorpay.key.id:}") String razorpayKeyId,
            @Value("${razorpay.key.secret:}") String razorpayKeySecret,
            @Value("${spring.mail.username:}") String mailFrom) {

        this.paymentRepository = paymentRepository;
        this.rideRepository = rideRepository;
        this.userRepository = userRepository;
        this.razorpayService = razorpayService;
        this.mailSender = mailSender;
        this.razorpayKeyId = razorpayKeyId;
        this.razorpayKeySecret = razorpayKeySecret;
        this.mailFrom = mailFrom;
    }

    @Transactional
    public Payment createPayment(Payment payment, String email) {

        if (!"CASH".equals(payment.getPaymentMethod())) {
            throw new IllegalArgumentException(
                    "Use the Razorpay checkout endpoint for online payments");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        if (payment.getRide() == null
                || payment.getRide().getId() == null) {
            throw new IllegalArgumentException("Ride ID is required");
        }

        Long rideId = payment.getRide().getId();

        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() ->
                        new RuntimeException("Ride not found"));

        validateRideOwnershipAndCompletion(ride, user);

        if (paymentRepository.existsByRideId(rideId)) {
            throw new IllegalStateException(
                    "Payment already exists for this ride");
        }

        payment.setRide(ride);
        payment.setAmount(ride.getFare());
        payment.setPaymentStatus("PENDING");
        payment.setRazorpayOrderId(null);
        payment.setRazorpayPaymentId(null);

        return paymentRepository.save(payment);
    }

    @Transactional
    public Payment createRazorpayOrder(Long rideId, String email) {

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() ->
                        new RuntimeException("Ride not found"));

        validateRideOwnershipAndCompletion(ride, user);

        if (paymentRepository.existsByRideId(rideId)) {
            throw new IllegalStateException(
                    "A payment record already exists for this ride");
        }

        Payment payment = new Payment();
        payment.setRide(ride);
        payment.setAmount(ride.getFare());
        payment.setPaymentMethod("CARD");
        payment.setPaymentStatus("PENDING");

        Payment savedPayment = paymentRepository.save(payment);

        String orderId = razorpayService.createOrder(
                savedPayment.getAmount(),
                savedPayment.getId());

        savedPayment.setRazorpayOrderId(orderId);

        return paymentRepository.save(savedPayment);
    }

    @Transactional
    public Payment verifyRazorpayPayment(
            Long paymentId,
            String email,
            String razorpayOrderId,
            String razorpayPaymentId,
            String razorpaySignature) {

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() ->
                        new RuntimeException("Payment not found"));

        Ride ride = payment.getRide();
        validateRideOwnershipAndCompletion(ride, user);

        if (!"PENDING".equals(payment.getPaymentStatus())) {
            throw new IllegalStateException(
                    "Only pending payments can be verified");
        }

        if (payment.getRazorpayOrderId() == null
                || !payment.getRazorpayOrderId().equals(razorpayOrderId)) {
            throw new IllegalArgumentException(
                    "Razorpay order ID does not match");
        }

        if (razorpayPaymentId == null
                || razorpayPaymentId.isBlank()
                || razorpaySignature == null
                || razorpaySignature.isBlank()) {
            throw new IllegalArgumentException(
                    "Razorpay payment ID and signature are required");
        }

        try {
            JSONObject attributes = new JSONObject();
            attributes.put("razorpay_order_id", razorpayOrderId);
            attributes.put("razorpay_payment_id", razorpayPaymentId);
            attributes.put("razorpay_signature", razorpaySignature);

            Utils.verifyPaymentSignature(
                    attributes, razorpayKeySecret);

        } catch (Exception e) {
            throw new IllegalArgumentException(
                    "Razorpay payment signature verification failed", e);
        }

        payment.setRazorpayPaymentId(razorpayPaymentId);
        payment.setPaymentStatus("PAID");

        Payment savedPayment = paymentRepository.save(payment);

        /*
         * Automatically email the receipt after successful verification.
         * An email failure must not turn a confirmed payment into a failure.
         */
        try {
            emailReceipt(savedPayment.getId(), email);
        } catch (Exception emailError) {
            log.error(
                    "Payment {} was confirmed, but receipt email delivery failed",
                    savedPayment.getId(),
                    emailError);
        }

        return savedPayment;
    }

    @Transactional(readOnly = true)
    public byte[] generateInvoicePdf(Long paymentId, String email) {

        Payment payment = getOwnedPaidPayment(paymentId, email);

        return buildInvoicePdf(payment);
    }

    @Transactional(readOnly = true)
    public void emailReceipt(Long paymentId, String email) {

        Payment payment = getOwnedPaidPayment(paymentId, email);
        byte[] pdf = buildInvoicePdf(payment);

        try {
            MimeMessage message = mailSender.createMimeMessage();

            MimeMessageHelper helper =
                    new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(email);

            if (mailFrom != null && !mailFrom.isBlank()) {
                helper.setFrom(mailFrom);
            }

            helper.setSubject(
                    "Cab Booking Receipt - Payment #" + paymentId);

            helper.setText(
                    "Hello " + safeText(payment.getRide().getUser().getName())
                            + ",\n\n"
                            + "Your payment is confirmed. "
                            + "Please find your PDF receipt attached.\n\n"
                            + "Thank you for using Cab Booking!",
                    false);

            helper.addAttachment(
                    "cab-booking-receipt-" + paymentId + ".pdf",
                    new ByteArrayResource(pdf),
                    "application/pdf");

            mailSender.send(message);

        } catch (MessagingException | RuntimeException e) {
            throw new IllegalStateException(
                    "Could not email the receipt. "
                            + "Check your mail configuration.", e);
        }
    }

    private Payment getOwnedPaidPayment(
            Long paymentId,
            String email) {

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() ->
                        new RuntimeException("Payment not found"));

        Ride ride = payment.getRide();

        if (ride == null
                || ride.getUser() == null
                || !ride.getUser().getId().equals(user.getId())) {

            throw new AccessDeniedException(
                    "You can access receipts only for your own rides");
        }

        if (!"PAID".equalsIgnoreCase(payment.getPaymentStatus())) {
            throw new IllegalStateException(
                    "A receipt is available only after payment is confirmed");
        }

        return payment;
    }

    private byte[] buildInvoicePdf(Payment payment) {

        Ride ride = payment.getRide();
        User user = ride.getUser();

        try (ByteArrayOutputStream output =
                     new ByteArrayOutputStream()) {

            Document document = new Document();
            PdfWriter.getInstance(document, output);
            document.open();

            Font titleFont = FontFactory.getFont(
                    FontFactory.HELVETICA_BOLD, 18);

            Font labelFont = FontFactory.getFont(
                    FontFactory.HELVETICA_BOLD, 11);

            document.add(new Paragraph("CAB BOOKING", titleFont));
            document.add(new Paragraph("Payment Receipt"));
            document.add(new Paragraph(" "));

            PdfPTable table = new PdfPTable(2);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{1.2f, 2.8f});

            addInvoiceRow(table, "Payment ID",
                    String.valueOf(payment.getId()), labelFont);

            addInvoiceRow(table, "Ride ID",
                    String.valueOf(ride.getId()), labelFont);

            addInvoiceRow(table, "Customer",
                    user.getName(), labelFont);

            addInvoiceRow(table, "Customer email",
                    user.getEmail(), labelFont);

            addInvoiceRow(table, "Pickup",
                    ride.getPickupAddress(), labelFont);

            addInvoiceRow(table, "Destination",
                    ride.getDropAddress(), labelFont);

            addInvoiceRow(table, "Payment method",
                    payment.getPaymentMethod(), labelFont);

            addInvoiceRow(table, "Payment status",
                    payment.getPaymentStatus(), labelFont);

            addInvoiceRow(table, "Transaction ID",
                    payment.getRazorpayPaymentId(), labelFont);

            addInvoiceRow(table, "Total amount",
                    String.format(
                            Locale.ROOT,
                            "INR %.2f",
                            payment.getAmount()),
                    labelFont);

            document.add(table);
            document.add(new Paragraph(" "));
            document.add(new Paragraph(
                    "Thank you for riding with Cab Booking!"));

            document.close();

            return output.toByteArray();

        } catch (DocumentException | IOException e) {
            throw new IllegalStateException(
                    "Could not generate the PDF receipt", e);
        }
    }

    private void addInvoiceRow(
            PdfPTable table,
            String label,
            String value,
            Font labelFont) {

        table.addCell(new Phrase(label, labelFont));

        table.addCell(new Phrase(
                value == null || value.isBlank() ? "N/A" : value));
    }

    private String safeText(String value) {
        return value == null || value.isBlank() ? "N/A" : value;
    }

    private void validateRideOwnershipAndCompletion(
            Ride ride, User user) {

        if (ride == null
                || ride.getUser() == null
                || !ride.getUser().getId().equals(user.getId())) {

            throw new AccessDeniedException(
                    "You can pay only for your own rides");
        }

        if (!"COMPLETED".equals(ride.getStatus())) {
            throw new IllegalStateException(
                    "Payment is allowed only for completed rides");
        }
    }

    @Transactional
    public Payment markPaymentAsPaid(Long paymentId, String email) {

        throw new UnsupportedOperationException(
                "Use Razorpay signature verification for online payments");
    }

    public List<Payment> getAllPayments() {
        return paymentRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<Payment> getMyPayments(String email) {

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        return paymentRepository.findByRideUserId(user.getId());
    }

    public String getRazorpayKeyId() {
        return razorpayKeyId;
    }
}
