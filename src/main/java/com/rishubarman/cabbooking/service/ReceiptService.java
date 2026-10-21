
package com.rishubarman.cabbooking.service;

import com.lowagie.text.Document;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import com.rishubarman.cabbooking.entity.Ride;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;

@Service
public class ReceiptService {

    public byte[] generateReceipt(Ride ride) {
        ByteArrayOutputStream outputStream =
                new ByteArrayOutputStream();

        Document document = new Document();

        try {
            PdfWriter.getInstance(document, outputStream);
            document.open();

            document.add(new Paragraph("CAB BOOKING APPLICATION"));
            document.add(new Paragraph("Ride Receipt"));
            document.add(new Paragraph(" "));

            document.add(new Paragraph(
                    "Ride ID: " + ride.getId()));

            document.add(new Paragraph(
                    "Status: " + ride.getStatus()));

            document.add(new Paragraph(
                    "Pickup: " + ride.getPickupLocation()));

            document.add(new Paragraph(
                    "Drop: " + ride.getDropLocation()));

            document.add(new Paragraph(
                    "Fare: INR " + ride.getFare()));

            if (ride.getUser() != null) {
                document.add(new Paragraph(
                        "Rider: " + ride.getUser().getName()));
            }

            if (ride.getDriver() != null) {
                document.add(new Paragraph(
                        "Driver: " + ride.getDriver().getName()));
            }

            document.add(new Paragraph(" "));
            document.add(new Paragraph(
                    "Thank you for choosing our service!"));

        } catch (Exception exception) {
            throw new IllegalStateException(
                    "Failed to generate ride receipt", exception);
        } finally {
            if (document.isOpen()) {
                document.close();
            }
        }

        return outputStream.toByteArray();
    }
}
