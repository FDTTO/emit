package dev.emit.infrastructure.async;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import dev.emit.infrastructure.multitenancy.TenantContextDecorator;
import lombok.RequiredArgsConstructor;

@EnableRetry
@EnableAsync
@Configuration
@RequiredArgsConstructor
public class AsyncConfig {

    private final TenantContextDecorator tenantContextDecorator;

    @Bean(name = "docProcessorExecutor")
    public Executor docProcessorExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(25);
        executor.setThreadNamePrefix("doc-processor-");
        executor.setTaskDecorator(tenantContextDecorator);
        executor.initialize();
        return executor;
    }
}
