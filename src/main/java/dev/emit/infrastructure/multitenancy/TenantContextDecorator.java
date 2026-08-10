package dev.emit.infrastructure.multitenancy;

import java.util.Map;

import org.slf4j.MDC;
import org.springframework.core.task.TaskDecorator;
import org.springframework.stereotype.Component;

@Component
public class TenantContextDecorator implements TaskDecorator {

    @Override
    public Runnable decorate(Runnable runnable) {
        String tenantId = TenantContext.getTenant();
        Map<String, String> mdcContext = MDC.getCopyOfContextMap();
        return () -> {
            try {
                TenantContext.setTenant(tenantId);
                if (mdcContext != null) {
                    MDC.setContextMap(mdcContext);
                }
                runnable.run();
            } finally {
                TenantContext.clear();
                MDC.clear();
            }
        };
    }
}
