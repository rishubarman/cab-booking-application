package com.rishubarman.cabbooking.controller;

import com.rishubarman.cabbooking.entity.SupportTicket;
import com.rishubarman.cabbooking.service.SupportTicketService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/support-tickets")
public class SupportTicketController {

    private final SupportTicketService supportTicketService;

    public SupportTicketController(SupportTicketService supportTicketService) {
        this.supportTicketService = supportTicketService;
    }

    @PostMapping
    public SupportTicket createTicket(@Valid @RequestBody SupportTicket ticket) {
        return supportTicketService.createTicket(ticket);
    }

    @GetMapping
    public List<SupportTicket> getAllTickets() {
        return supportTicketService.getAllTickets();
    }
}