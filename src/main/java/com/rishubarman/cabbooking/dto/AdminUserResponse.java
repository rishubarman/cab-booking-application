
package com.rishubarman.cabbooking.dto;

public record AdminUserResponse(
        Long id,
        String name,
        String email,
        String phone,
        String role
) {
}
