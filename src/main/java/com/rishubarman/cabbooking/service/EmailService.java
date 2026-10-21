
package com.rishubarman.cabbooking.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendReceiptEmail(
            String recipientEmail,
            String riderName,
            Long rideId,
            byte[] pdfReceipt) {

        try {
            MimeMessage message = mailSender.createMimeMessage();

            MimeMessageHelper helper = new MimeMessageHelper(
                    message, true, "UTF-8");

            helper.setTo(recipientEmail);
            helper.setSubject("Your Cab Booking Receipt - Ride #" + rideId);

            helper.setText(
                    "Hello " + riderName + ",\n\n"
                            + "Thank you for choosing our Cab Booking Application.\n"
                            + "Your receipt for completed Ride #" + rideId
                            + " is attached to this email.\n\n"
                            + "Regards,\n"
                            + "Cab Booking Team"
            );

            helper.addAttachment(
                    "ride-receipt-" + rideId + ".pdf",
                    new ByteArrayResource(pdfReceipt),
                    "application/pdf"
            );

            mailSender.send(message);

        } catch (MessagingException exception) {
            throw new IllegalStateException(
                    "Failed to prepare receipt email", exception);
        }
    }
}
