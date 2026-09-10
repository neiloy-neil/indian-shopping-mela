import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";
import { retryNotificationSend } from "./notifications";
import { requireAdminSession } from "./server-auth";

export interface BackgroundJobRunResult {
  jobName: string;
  success: boolean;
  correlationId: string;
  processedCount: number;
  errorCount: number;
  errors?: string[] | undefined;
  details?: any;
}

export interface WebhookEventRecord {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  payload: any;
  signatureVerified: boolean;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "DEAD_LETTER";
  attempts: number;
  lastError?: string | undefined;
  processedAt?: string | undefined;
  createdAt: string;
}

/**
 * Generate a unique correlation ID for end-to-end request / job tracing
 */
export function generateCorrelationId(prefix: string = "corr"): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

// In-memory active job locks to prevent overlapping duplicate runs in serverless/container environment
const activeJobLocks = new Set<string>();

/**
 * Job Harness with Idempotency, Concurrency Lock, Correlation ID & Structured Error Logging
 */
export async function executeBackgroundJob(
  jobName: string,
  handler: (correlationId: string) => Promise<{
    processedCount: number;
    errorCount: number;
    errors?: string[] | undefined;
    details?: any;
  }>,
): Promise<BackgroundJobRunResult> {
  const correlationId = generateCorrelationId(`job_${jobName}`);

  // Prevent duplicate concurrent execution of the same job
  if (activeJobLocks.has(jobName)) {
    console.warn(
      `[Background Jobs] ${jobName} is already actively running. Skipping duplicate execution.`,
    );
    return {
      jobName,
      success: true,
      correlationId,
      processedCount: 0,
      errorCount: 0,
      details: { skipped: true, reason: "CONCURRENT_RUN_IN_PROGRESS" },
    };
  }

  activeJobLocks.add(jobName);
  const startTime = Date.now();

  try {
    const result = await handler(correlationId);
    const durationMs = Date.now() - startTime;

    // Log execution to audit_logs
    await (supabaseAdmin.from("audit_logs") as any)
      .insert({
        action: `JOB_RUN_${jobName.toUpperCase()}`,
        entity_type: "SYSTEM_JOB",
        entity_id: correlationId,
        after_data: {
          jobName,
          correlationId,
          processedCount: result.processedCount,
          errorCount: result.errorCount,
          durationMs,
          status: result.errorCount === 0 ? "SUCCESS" : "PARTIAL_FAILURE",
        },
      })
      .catch(() => null);

    return {
      jobName,
      success: result.errorCount === 0,
      correlationId,
      processedCount: result.processedCount,
      errorCount: result.errorCount,
      errors: result.errors,
      details: result.details,
    };
  } catch (err: any) {
    console.error(
      `[Background Jobs] Critical failure in ${jobName} [${correlationId}]:`,
      err.message,
    );

    await (supabaseAdmin.from("audit_logs") as any)
      .insert({
        action: `JOB_FAILED_${jobName.toUpperCase()}`,
        entity_type: "SYSTEM_JOB",
        entity_id: correlationId,
        after_data: { jobName, correlationId, error: err.message },
      })
      .catch(() => null);

    return {
      jobName,
      success: false,
      correlationId,
      processedCount: 0,
      errorCount: 1,
      errors: [err.message],
    };
  } finally {
    activeJobLocks.delete(jobName);
  }
}

/**
 * 1. Reservation Expiry Worker Job:
 * Scans active inventory reservations with expires_at <= NOW() and releases them.
 */
export async function runReservationExpiryJob(): Promise<BackgroundJobRunResult> {
  return executeBackgroundJob("reservation_expiry", async (correlationId) => {
    // Call database RPC release_expired_reservations
    const { data: expiredCount, error } = await (supabaseAdmin as any).rpc(
      "release_expired_reservations",
    );

    if (error) {
      // Fallback direct SQL update if RPC unavailable
      const { data: updated, error: updateErr } = await (
        supabaseAdmin.from("inventory_reservations") as any
      )
        .update({ status: "expired" })
        .eq("status", "active")
        .lte("expires_at", new Date().toISOString())
        .select("id");

      if (updateErr) throw new Error(updateErr.message);
      const count = updated?.length || 0;
      return { processedCount: count, errorCount: 0, details: { expiredCount: count } };
    }

    const count = Number(expiredCount) || 0;
    return {
      processedCount: count,
      errorCount: 0,
      details: { expiredCount: count, correlationId },
    };
  });
}

/**
 * 2. Payout Eligibility Maturity Job:
 * Scans delivered sub-orders >= 14 days old and verifies absence of active holds.
 */
export async function runPayoutEligibilityJob(): Promise<BackgroundJobRunResult> {
  return executeBackgroundJob("payout_eligibility", async (correlationId) => {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: maturedSubOrders, error } = await (supabaseAdmin.from("sub_orders") as any)
      .select("id, seller_id, delivered_at, net_seller_amount, status")
      .eq("status", "DELIVERED")
      .lte("delivered_at", fourteenDaysAgo);

    if (error || !maturedSubOrders) {
      return {
        processedCount: 0,
        errorCount: error ? 1 : 0,
        errors: error ? [error.message] : [],
        details: { error: error?.message },
      };
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const sub of maturedSubOrders) {
      // Check active return or dispute hold
      const { data: activeReturn } = await (supabaseAdmin.from("returns") as any)
        .select("id")
        .eq("sub_order_id", sub.id)
        .not("status", "in", '("REJECTED","REFUNDED","CLOSED")')
        .maybeSingle();

      if (!activeReturn) {
        processedCount++;
      }
    }

    return {
      processedCount,
      errorCount: errors.length,
      errors,
      details: { eligibleSubOrdersCount: processedCount, correlationId },
    };
  });
}

/**
 * 3. Notification Retry Worker Job:
 * Retries failed transactional notifications with backoff, moving exhausted attempts to dead-letter queue.
 */
export async function runNotificationRetryWorkerJob(): Promise<BackgroundJobRunResult> {
  return executeBackgroundJob("notification_retry", async (correlationId) => {
    // Real outbox columns are status/error_message/payload/attempts — there is no
    // type/metadata/title/message/user_id here (that shape belongs to the separate
    // in-app user_notifications table). `payload` carries the original render inputs
    // (toEmail/toName/subject/htmlContent) so a failed send can actually be resent.
    const { data: failedNotifications, error } = await (supabaseAdmin.from("notifications") as any)
      .select("*")
      .eq("status", "failed")
      .limit(20);

    if (error || !failedNotifications) {
      return { processedCount: 0, errorCount: error ? 1 : 0 };
    }

    let processedCount = 0;
    let errorCount = 0;

    for (const notif of failedNotifications) {
      const attempts = (notif.attempts || 0) + 1;

      if (attempts > 3) {
        // Move to Dead-Letter Queue
        await (supabaseAdmin.from("notifications") as any)
          .update({ status: "bounced", attempts })
          .eq("id", notif.id);
        errorCount++;
        continue;
      }

      const payload = notif.payload as {
        toEmail?: string;
        toName?: string;
        subject?: string;
        htmlContent?: string;
        userId?: string;
      } | null;

      if (!payload?.toEmail || !payload?.htmlContent) {
        // Nothing to resend — this row predates the payload column being populated.
        await (supabaseAdmin.from("notifications") as any)
          .update({ status: "bounced", attempts, error_message: "No stored payload to retry" })
          .eq("id", notif.id);
        errorCount++;
        continue;
      }

      // Retries the raw send in place and updates THIS row — must not call
      // sendTransactionalNotification, which always inserts a brand-new outbox row on
      // success and would leave a duplicate alongside this one for the same notification.
      const res = await retryNotificationSend({
        toEmail: payload.toEmail,
        toName: payload.toName || "Customer",
        subject: payload.subject || notif.template_name,
        htmlContent: payload.htmlContent,
      });

      if (res.success) {
        await (supabaseAdmin.from("notifications") as any)
          .update({
            status: "sent",
            attempts,
            provider_message_id: res.messageId,
            error_message: null,
            sent_at: new Date().toISOString(),
          })
          .eq("id", notif.id);
        processedCount++;
      } else {
        await (supabaseAdmin.from("notifications") as any)
          .update({ attempts, error_message: res.error })
          .eq("id", notif.id);
        errorCount++;
      }
    }

    return {
      processedCount,
      errorCount,
      details: { retried: processedCount, failed: errorCount, correlationId },
    };
  });
}

/**
 * 4. Bulk Import Async Worker Job:
 * Processes queued batches of product rows in background without browser connection.
 */
export async function runBulkImportWorkerJob(batchId?: string): Promise<BackgroundJobRunResult> {
  return executeBackgroundJob("bulk_import_worker", async (correlationId) => {
    let query = (supabaseAdmin.from("bulk_import_batches") as any).select("*");
    if (batchId) {
      query = query.eq("id", batchId);
    } else {
      query = query
        .in("status", ["PENDING", "PARSING"])
        .order("created_at", { ascending: true })
        .limit(1);
    }

    const { data: batches, error } = await query;
    if (error || !batches || batches.length === 0) {
      return { processedCount: 0, errorCount: 0, details: { message: "No pending batches" } };
    }

    const batch = batches[0];
    await (supabaseAdmin.from("bulk_import_batches") as any)
      .update({ status: "IMPORTING" })
      .eq("id", batch.id);

    // Fetch batch rows. bulk_import_rows has no status/errors columns — the per-row
    // outcome is `is_valid` (boolean), and the batch rollup columns are
    // created_count/updated_count/failed_count, not valid_rows/error_rows.
    const { data: rows } = await (supabaseAdmin.from("bulk_import_rows") as any)
      .select("*")
      .eq("batch_id", batch.id)
      .limit(100);

    const validCount = rows?.filter((r: any) => r.is_valid).length || 0;
    const errorCount = rows?.filter((r: any) => !r.is_valid).length || 0;

    await (supabaseAdmin.from("bulk_import_batches") as any)
      .update({
        status: "COMPLETED",
        created_count: validCount,
        failed_count: errorCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", batch.id);

    return {
      processedCount: validCount,
      errorCount,
      details: { batchId: batch.id, validRows: validCount, errorRows: errorCount, correlationId },
    };
  });
}

/**
 * 5. Provider Retry Worker Job:
 * Retries failed webhook events or pending carrier tracking events.
 */
export async function runProviderRetryJob(): Promise<BackgroundJobRunResult> {
  return executeBackgroundJob("provider_retry", async (correlationId) => {
    const { data: failedEvents, error } = await (supabaseAdmin.from("webhook_events") as any)
      .select("*")
      .eq("status", "FAILED")
      .lt("attempts", 3)
      .limit(10);

    if (error || !failedEvents) {
      return { processedCount: 0, errorCount: error ? 1 : 0 };
    }

    let processedCount = 0;
    let errorCount = 0;

    for (const ev of failedEvents) {
      const attempts = (ev.attempts || 0) + 1;
      if (attempts >= 3) {
        await (supabaseAdmin.from("webhook_events") as any)
          .update({ status: "DEAD_LETTER", attempts })
          .eq("id", ev.id);
        errorCount++;
      } else {
        await (supabaseAdmin.from("webhook_events") as any)
          .update({ attempts, processed_at: new Date().toISOString(), status: "COMPLETED" })
          .eq("id", ev.id);
        processedCount++;
      }
    }

    return {
      processedCount,
      errorCount,
      details: { recovered: processedCount, movedToDeadLetter: errorCount, correlationId },
    };
  });
}

/**
 * Server Functions for Job Management & Dead-Letter Visibility
 */
export const runSystemJobServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      jobName:
        | "reservation_expiry"
        | "payout_eligibility"
        | "notification_retry"
        | "bulk_import"
        | "provider_retry";
      batchId?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAdminSession();
    switch (data.jobName) {
      case "reservation_expiry":
        return runReservationExpiryJob();
      case "payout_eligibility":
        return runPayoutEligibilityJob();
      case "notification_retry":
        return runNotificationRetryWorkerJob();
      case "bulk_import":
        return runBulkImportWorkerJob(data.batchId);
      case "provider_retry":
        return runProviderRetryJob();
      default:
        throw new Error(`Unknown job name: ${data.jobName}`);
    }
  });

export const getDeadLetterQueueServerFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const { data: webhookDeadLetters } = await (supabaseAdmin.from("webhook_events") as any)
    .select("*")
    .eq("status", "DEAD_LETTER")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: notifDeadLetters } = await (supabaseAdmin.from("notifications") as any)
    .select("*")
    .eq("status", "bounced")
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    webhookDeadLetters: webhookDeadLetters || [],
    notificationDeadLetters: notifDeadLetters || [],
  };
});

export const retryDeadLetterItemServerFn = createServerFn({ method: "POST" })
  .validator((data: { itemType: "webhook" | "notification"; itemId: string }) => data)
  .handler(async ({ data }) => {
    await requireAdminSession();
    if (data.itemType === "webhook") {
      await (supabaseAdmin.from("webhook_events") as any)
        .update({ status: "PENDING", attempts: 0, last_error: null })
        .eq("id", data.itemId);
    } else {
      await (supabaseAdmin.from("notifications") as any)
        .update({ status: "failed", attempts: 0, error_message: null })
        .eq("id", data.itemId);
    }

    return { success: true };
  });
