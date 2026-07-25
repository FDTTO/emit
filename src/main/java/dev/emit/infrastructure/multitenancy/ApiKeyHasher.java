package dev.emit.infrastructure.multitenancy;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public class ApiKeyHasher {

    public static String hash(String apiKey) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(apiKey.getBytes(StandardCharsets.UTF_8));
            StringBuilder stringBuilder = new StringBuilder();

            for (byte singleByte : hashBytes) {
                stringBuilder.append(String.format("%02x", singleByte));
            }

            return stringBuilder.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new RuntimeException("SHA-256 algorithm not available");
        }
    }

}
