package dev.emit.shared.multitenancy;

import java.util.Map;

import org.slf4j.MDC;
import org.springframework.stereotype.Component;

@Component
public class TenantContextDecorator {

    public void run(String tenantSchema, Map<String, String> mdcEntries, Runnable action) {
        try {
            TenantContext.setTenant(tenantSchema);
            mdcEntries.forEach(MDC::put);
            action.run();
        } finally {
            TenantContext.clear();
            MDC.clear();
        }
    }
}
