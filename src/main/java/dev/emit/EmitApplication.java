package dev.emit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class EmitApplication {

    public static void main(String[] args) {
        SpringApplication.run(EmitApplication.class, args);
    }
}
