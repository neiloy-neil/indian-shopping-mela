import { redactSensitiveData, sanitizeForLogging } from "@/lib/security/logger-redaction";

export type SeverityLevel = "fatal" | "error" | "warning" | "info" | "debug";

export interface ErrorContext {
  userId?: string | undefined;
  sellerId?: string | undefined;
  orderId?: string | undefined;
  route?: string | undefined;
  method?: string | undefined;
  requestId?: string | undefined;
  correlationId?: string | undefined;
  extra?: Record<string, unknown> | undefined;
}

export interface Breadcrumb {
  category: "auth" | "checkout" | "payment" | "shipping" | "inventory" | "admin" | "http" | "job";
  message: string;
  level?: SeverityLevel | undefined;
  timestamp?: number | undefined;
  data?: Record<string, unknown> | undefined;
}

export interface CapturedEvent {
  eventId: string;
  timestamp: string;
  environment: string;
  level: SeverityLevel;
  message: string;
  stack?: string | undefined;
  context?: ErrorContext | undefined;
  breadcrumbs: Breadcrumb[];
  sanitized: boolean;
}

const recentBreadcrumbs: Breadcrumb[] = [];
const MAX_BREADCRUMBS = 50;

/**
 * Appends an operational breadcrumb with automatic secret/PII redaction.
 */
export function addBreadcrumb(breadcrumb: Breadcrumb): void {
  const sanitizedData = breadcrumb.data ? (redactSensitiveData(breadcrumb.data) as Record<string, unknown>) : undefined;
  recentBreadcrumbs.push({
    ...breadcrumb,
    timestamp: breadcrumb.timestamp ?? Date.now(),
    data: sanitizedData,
  });
  if (recentBreadcrumbs.length > MAX_BREADCRUMBS) {
    recentBreadcrumbs.shift();
  }
}

/**
 * Returns current in-memory breadcrumbs for error diagnostic context.
 */
export function getRecentBreadcrumbs(): readonly Breadcrumb[] {
  return [...recentBreadcrumbs];
}

/**
 * Clear breadcrumbs (e.g. after capture or in tests).
 */
export function clearBreadcrumbs(): void {
  recentBreadcrumbs.length = 0;
}

/**
 * Server-side error capture with fail-safe PII/secrets redaction.
 */
export function captureServerException(
  error: unknown,
  context?: ErrorContext,
  level: SeverityLevel = "error",
): CapturedEvent {
  const eventId = `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown server error";
  const stack = error instanceof Error ? error.stack : undefined;

  const sanitizedContext: ErrorContext = context
    ? {
        userId: context.userId,
        sellerId: context.sellerId,
        orderId: context.orderId,
        route: context.route,
        method: context.method,
        requestId: context.requestId,
        correlationId: context.correlationId,
        extra: context.extra ? (redactSensitiveData(context.extra) as Record<string, unknown>) : undefined,
      }
    : {};

  const event: CapturedEvent = {
    eventId,
    timestamp: new Date().toISOString(),
    environment: process.env["NODE_ENV"] ?? "development",
    level,
    message: sanitizeForLogging(message),
    stack: stack ? sanitizeForLogging(stack) : undefined,
    context: sanitizedContext,
    breadcrumbs: [...recentBreadcrumbs],
    sanitized: true,
  };

  // Structured production log with zero credential leakage
  if (level === "fatal" || level === "error") {
    console.error(`[ISM_MONITORING][${level.toUpperCase()}] eventId=${eventId}: ${event.message}`, {
      context: event.context,
      breadcrumbsCount: event.breadcrumbs.length,
    });
  } else {
    console.warn(`[ISM_MONITORING][${level.toUpperCase()}] eventId=${eventId}: ${event.message}`, {
      context: event.context,
    });
  }

  return event;
}

/**
 * Client-side error capture with PII redaction.
 */
export function captureClientException(
  error: unknown,
  context?: ErrorContext,
  level: SeverityLevel = "error",
): CapturedEvent {
  const eventId = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown client error";
  const stack = error instanceof Error ? error.stack : undefined;

  const sanitizedContext: ErrorContext = context
    ? {
        route: context.route || (typeof window !== "undefined" ? window.location.pathname : undefined),
        extra: context.extra ? (redactSensitiveData(context.extra) as Record<string, unknown>) : undefined,
      }
    : {};

  const event: CapturedEvent = {
    eventId,
    timestamp: new Date().toISOString(),
    environment: "client",
    level,
    message: sanitizeForLogging(message),
    stack: stack ? sanitizeForLogging(stack) : undefined,
    context: sanitizedContext,
    breadcrumbs: [...recentBreadcrumbs],
    sanitized: true,
  };

  return event;
}
