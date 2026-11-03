package com.finedge.los.logging;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Logs method lifecycle without logging arguments, return values, credentials or customer data. */
@Aspect
@Component
public class MethodLifecycleLoggingAspect {
    private static final Logger log = LoggerFactory.getLogger(MethodLifecycleLoggingAspect.class);

    @Around("execution(* com.finedge.los.controller..*(..)) || " +
            "execution(* com.finedge.los.service..*(..)) || " +
            "execution(* com.finedge.los.repository..*(..)) || " +
            "execution(* com.finedge.los.config..*(..))")
    public Object trace(ProceedingJoinPoint joinPoint) throws Throwable {
        String method = joinPoint.getSignature().toShortString();
        long started = System.nanoTime();
        log.debug("ENTER {}", method);
        try {
            Object result = joinPoint.proceed();
            log.debug("EXIT {} durationMs={}", method, (System.nanoTime() - started) / 1_000_000);
            return result;
        } catch (Throwable error) {
            // Exception message and stack may contain customer information; do not log them here.
            log.warn("FAIL {} exceptionType={} durationMs={}", method,
                    error.getClass().getSimpleName(), (System.nanoTime() - started) / 1_000_000);
            throw error;
        }
    }
}
