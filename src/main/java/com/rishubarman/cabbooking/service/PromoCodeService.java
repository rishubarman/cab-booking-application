package com.rishubarman.cabbooking.service;

import com.rishubarman.cabbooking.entity.PromoCode;
import com.rishubarman.cabbooking.repository.PromoCodeRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PromoCodeService {

    private final PromoCodeRepository promoCodeRepository;

    public PromoCodeService(PromoCodeRepository promoCodeRepository) {
        this.promoCodeRepository = promoCodeRepository;
    }

    public PromoCode createPromoCode(PromoCode promoCode) {
        return promoCodeRepository.save(promoCode);
    }

    public List<PromoCode> getAllPromoCodes() {
        return promoCodeRepository.findAll();
    }
}