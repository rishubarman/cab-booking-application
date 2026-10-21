
package com.rishubarman.cabbooking.security;

import com.rishubarman.cabbooking.service.CustomUserDetailsService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Collection;

@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    @Value("${jwt.secret}")
    private String secret;

    private final CustomUserDetailsService userDetailsService;

    public WebSocketAuthInterceptor(
            CustomUserDetailsService userDetailsService) {
        this.userDetailsService = userDetailsService;
    }

    @Override
    public Message<?> preSend(
            Message<?> message,
            MessageChannel channel) {

        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(
                        message, StompHeaderAccessor.class);

        if (accessor == null) {
            throw new IllegalArgumentException(
                    "Invalid WebSocket message");
        }

        StompCommand command = accessor.getCommand();

        if (command == StompCommand.CONNECT) {
            authenticate(accessor);
        } else if (command == StompCommand.SUBSCRIBE) {
            authorizeSubscription(accessor);
        } else if (command == StompCommand.SEND) {
            // Clients may not publish messages to application destinations.
            throw new IllegalArgumentException(
                    "Client messages are not permitted");
        }

        return message;
    }

    private void authenticate(StompHeaderAccessor accessor) {

        String authorization =
                accessor.getFirstNativeHeader("Authorization");

        if (authorization == null
                || !authorization.startsWith("Bearer ")) {
            throw new IllegalArgumentException(
                    "Missing WebSocket authentication token");
        }

        try {
            String token = authorization.substring(7);

            SecretKey key =
                    io.jsonwebtoken.security.Keys.hmacShaKeyFor(
                            secret.getBytes(StandardCharsets.UTF_8));

            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            String email = claims.getSubject();

            if (email == null || email.isBlank()) {
                throw new IllegalArgumentException(
                        "Invalid token subject");
            }

            UserDetails user =
                    userDetailsService.loadUserByUsername(email);

            Authentication authentication =
                    new UsernamePasswordAuthenticationToken(
                            user,
                            null,
                            user.getAuthorities());

            accessor.setUser(authentication);

        } catch (Exception exception) {
            throw new IllegalArgumentException(
                    "Invalid WebSocket authentication token");
        }
    }

    private void authorizeSubscription(
            StompHeaderAccessor accessor) {

        Authentication authentication = accessor.getUser() instanceof Authentication
                ? (Authentication) accessor.getUser()
                : null;

        if (authentication == null
                || !authentication.isAuthenticated()) {
            throw new IllegalArgumentException(
                    "WebSocket authentication required");
        }

        String destination = accessor.getDestination();

        if (destination == null) {
            throw new IllegalArgumentException(
                    "Subscription destination is required");
        }

        Collection<? extends GrantedAuthority> authorities =
                authentication.getAuthorities();

        boolean isDriver = authorities.stream()
                .anyMatch(a -> "ROLE_DRIVER".equals(a.getAuthority()));

        boolean isUser = authorities.stream()
                .anyMatch(a -> "ROLE_USER".equals(a.getAuthority()));

        boolean isAdmin = authorities.stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));

        // Driver-only feed for pending ride availability.
        if ("/topic/ride-availability".equals(destination)) {
            if (!isDriver && !isAdmin) {
                throw new IllegalArgumentException(
                        "Only drivers and admins may subscribe to ride availability");
            }
            return;
        }

        // Private messages routed by Spring to the current authenticated user.
        if ("/user/queue/rides".equals(destination)
                || "/queue/rides".equals(destination)) {
            if (!isUser && !isDriver && !isAdmin) {
                throw new IllegalArgumentException(
                        "Role not permitted to subscribe to ride updates");
            }
            return;
        }

        // Reject all other subscriptions by default.
        throw new IllegalArgumentException(
                "Subscription destination is not permitted");
    }
}
