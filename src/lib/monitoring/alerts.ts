import { redactSensitiveData, sanitizeForLogging } from "@/lib/security/logger-redaction";

export type AlertType =
  | "PAYMENT_WEBHOOK_FAILURE"
  | "SHIPPING_FAILURE"
  | "IMPORT_FAILURE"
  | "PAYOUT_FAILURE"
  | "VIDEO_FAILURE"
  | "UPTIME_DEGRADATION"
  | "SECURITY_ANOMALY";

export type AlertPriority = "P1_CRITICAL" | "P2_HIGH" | "P3_MEDIUM" | "P4_LOW";

export interface OperationalAlert {
  alertId: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  description: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  actionRequired: string;
  notifiedChannels: string[];
}

export interface AlertDispatchResult {
  success: boolean;
  alertId: string;
  delivered: boolean;
  channel: string;
  timestamp: string;
}

const alertHistory: OperationalAlert[] = [];
const MAX_ALERT_HISTORY = 100;

/**
 * Creates and dispatches an authoritative operational alert across configured channels.
 */
export async function dispatchOperationalAlert(params: {
  type: AlertType;
  priority: AlertPriority;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  actionRequired: string;
}): Promise<OperationalAlert> {
  const alertId = `alt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const sanitizedMetadata = params.metadata
    ? (redactSensitiveData(params.metadata) as Record<string, unknown>)
    : {};

  const alert: OperationalAlert = {
    alertId,
    type: params.type,
    priority: params.priority,
    title: sanitizeForLogging(params.title),
    description: sanitizeForLogging(params.description),
    timestamp: new Date().toISOString(),
    metadata: sanitizedMetadata,
    actionRequired: params.actionRequired,
    notifiedChannels: ["console_audit", "structured_telemetry"],
  };

  alertHistory.unshift(alert);
  if (alertHistory.length > MAX_ALERT_HISTORY) {
    alertHistory.pop();
  }

  // Production logging format with severity prefix
  const prefix = `[ISM_ALERT][${alert.priority}][${alert.type}]`;
  if (alert.priority === "P1_CRITICAL" || alert.priority === "P2_HIGH") {
    console.error(`${prefix} ${alert.title} - ${alert.description}`, {
      alertId: alert.alertId,
      actionRequired: alert.actionRequired,
      metadata: alert.metadata,
    });
  } else {
    console.warn(`${prefix} ${alert.title} - ${alert.description}`, {
      alertId: alert.alertId,
      actionRequired: alert.actionRequired,
      metadata: alert.metadata,
    });
  }

  // Webhook dispatch if configured in environment
  const alertWebhookUrl = process.env["ALERT_WEBHOOK_URL"];
  if (alertWebhookUrl && typeof fetch === "function") {
    try {
      await fetch(alertWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 ${alert.priority}: ${alert.title}\n${alert.description}\nAction: ${alert.actionRequired}`,
          alert,
        }),
      });
      alert.notifiedChannels.push("webhook");
    } catch (e: any) {
      console.error(`[ISM_ALERT] Failed to deliver alert webhook: ${e?.message}`);
    }
  }

  return alert;
}

/**
 * Retrieves the recent history of operational alerts.
 */
export function getAlertHistory(): readonly OperationalAlert[] {
  return [...alertHistory];
}

/**
 * Clears alert history (useful for test isolation).
 */
export function clearAlertHistory(): void {
  alertHistory.length = 0;
}
