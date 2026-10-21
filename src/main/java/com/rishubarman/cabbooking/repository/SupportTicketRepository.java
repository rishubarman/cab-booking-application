package com.rishubarman.cabbooking.repository;

import com.rishubarman.cabbooking.entity.SupportTicket;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupportTicketRepository extends JpaRepository<SupportTicket, Long> {
}