package com.rishubarman.cabbooking.service;

import com.rishubarman.cabbooking.entity.SupportTicket;
import com.rishubarman.cabbooking.repository.SupportTicketRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SupportTicketService {

    private final SupportTicketRepository supportTicketRepository;

    public SupportTicketService(SupportTicketRepository supportTicketRepository) {
        this.supportTicketRepository = supportTicketRepository;
    }

    public SupportTicket createTicket(SupportTicket ticket) {
        return supportTicketRepository.save(ticket);
    }

    public List<SupportTicket> getAllTickets() {
        return supportTicketRepository.findAll();
    }
}