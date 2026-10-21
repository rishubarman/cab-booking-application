package com.rishubarman.cabbooking.controller;

import com.rishubarman.cabbooking.entity.PromoCode;
import com.rishubarman.cabbooking.service.PromoCodeService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/promo-codes")
public class PromoCodeController {

    private final PromoCodeService promoCodeService;

    public PromoCodeController(PromoCodeService promoCodeService) {
        this.promoCodeService = promoCodeService;
    }

    @PostMapping
    public PromoCode createPromoCode(@Valid @RequestBody PromoCode promoCode) {
        return promoCodeService.createPromoCode(promoCode);
    }

    @GetMapping
    public List<PromoCode> getAllPromoCodes() {
        return promoCodeService.getAllPromoCodes();
    }
}