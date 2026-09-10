import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/config/env";
import { getVerifiedSessionUserId, requireAdminSession } from "./server-auth";

export interface TransactionalEmailPayload {
  toEmail: string;
  toName: string;
  subject: string;
  htmlContent: string;
  idempotencyKey?: string | undefined;
  userId?: string | undefined;
  notificationType?: string | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
}

export interface NotificationSendResult {
  success: boolean;
  messageId?: string | undefined;
  idempotencyKey?: string | undefined;
  error?: string | undefined;
  alreadySent?: boolean | undefined;
}

// In-memory deduplication set for fast serverless idempotency protection
const processedNotificationKeys = new Set<string>();

interface BrevoDispatchResult {
  success: boolean;
  messageId?: string | undefined;
  error?: string | undefined;
  /** True when no BREVO_API_KEY is configured outside production (dev/local no-op send). */
  isDevNoop?: boolean | undefined;
}

/**
 * Raw Brevo HTTP dispatch with fail-closed provider check and exponential-backoff retry.
 * Pure send — does NOT touch the database. Callers own writing the outbox row: a fresh
 * send (sendTransactionalNotification) inserts a new row, while a retry of an existing
 * failed row (see jobs.ts) must update that same row rather than insert a second one.
 */
async function dispatchViaBrevo(payload: TransactionalEmailPayload): Promise<BrevoDispatchResult> {
  const env = typeof process !== "undefined" && process.env ? process.env : {};
  const apiKey = env["BREVO_API_KEY"];
  const senderEmail = env["BREVO_SENDER_EMAIL"] ?? "orders@indianshoppingmela.com.au";
  const senderName = env["BREVO_SENDER_NAME"] ?? "Indian Shopping Mela";
  const isProduction = env["NODE_ENV"] === "production";

  if (!apiKey) {
    if (isProduction) {
      console.error("[Notifications] CRITICAL: Missing BREVO_API_KEY in production.");
      return { success: false, error: "EMAIL_PROVIDER_NOT_CONFIGURED" };
    }
    console.log(`[Brevo Email Dev] To: ${payload.toEmail} | Subject: ${payload.subject}`);
    return { success: true, messageId: `dev-notif-${Date.now()}`, isDevNoop: true };
  }

  let lastError = "";
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: payload.toEmail, name: payload.toName }],
          subject: payload.subject,
          htmlContent: payload.htmlContent,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        lastError = `Brevo API ${response.status}: ${errBody}`;
        if (response.status >= 500 && attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
          continue;
        }
        break;
      }

      const resData = (await response.json()) as any;
      return { success: true, messageId: resData?.messageId || `msg_${Date.now()}` };
    } catch (netErr: any) {
      lastError = netErr.message;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
  }

  return { success: false, error: lastError || "Failed to send email after retries" };
}

/**
 * Brevo / Transactional Email Dispatcher with Idempotency, Retry Backoff & Fail-Closed Guards.
 * Use this for a fresh, application-triggered send (order confirmation, shipped, etc) — it
 * both sends and writes the outbox row. To retry an existing failed outbox row, use
 * jobs.ts's runNotificationRetryWorkerJob instead, which updates that row in place.
 */
export async function sendTransactionalNotification(
  payload: TransactionalEmailPayload,
): Promise<NotificationSendResult> {
  // 1. Idempotency Check: Prevent duplicate email sends on retried webhooks / concurrent jobs
  const key = payload.idempotencyKey || `notif_${payload.toEmail}_${Date.now()}`;
  if (payload.idempotencyKey && processedNotificationKeys.has(payload.idempotencyKey)) {
    return {
      success: true,
      idempotencyKey: payload.idempotencyKey,
      messageId: `idempotent-dedup-${payload.idempotencyKey}`,
      alreadySent: true,
    };
  }

  // 2. Check Database Outbox / Notification History. public.notifications is the outbound
  // send-log table — idempotency_key is its own column, there is no metadata column here
  // (that shape belongs to the separate public.user_notifications in-app bell table).
  if (payload.idempotencyKey) {
    try {
      const { data: existing } = await (supabaseAdmin.from("notifications") as any)
        .select("id, provider_message_id, status")
        .eq("idempotency_key", payload.idempotencyKey)
        .eq("status", "sent")
        .abortSignal(AbortSignal.timeout(500))
        .maybeSingle();

      if (existing) {
        processedNotificationKeys.add(payload.idempotencyKey);
        return {
          success: true,
          idempotencyKey: payload.idempotencyKey,
          messageId: existing.provider_message_id ?? existing.id,
          alreadySent: true,
        };
      }
    } catch {
      // Non-blocking query failure
    }
  }

  const result = await dispatchViaBrevo(payload);

  if (result.success) {
    processedNotificationKeys.add(key);

    if (!result.isDevNoop) {
      // Record in the real outbox table (public.notifications). Real columns are
      // entity_type/entity_id/template_name/channel/recipient_email/status/
      // provider_message_id/idempotency_key/sent_at — there is no user_id/title/
      // message/type/metadata here (that shape belongs to user_notifications, the
      // separate in-app bell table, written to below only when userId is provided).
      try {
        await (supabaseAdmin.from("notifications") as any)
          .insert({
            entity_type: payload.entityType ?? "notification",
            entity_id: payload.entityId ?? key,
            template_name: payload.notificationType || "GENERIC",
            channel: "email",
            recipient_email: payload.toEmail,
            status: "sent",
            provider_message_id: result.messageId,
            idempotency_key: key,
            sent_at: new Date().toISOString(),
          })
          .abortSignal(AbortSignal.timeout(500));
      } catch (dbErr: any) {
        console.warn("[Notifications] Failed to persist outbox record:", dbErr.message);
      }

      if (payload.userId) {
        try {
          await (supabaseAdmin.from("user_notifications") as any)
            .insert({
              user_id: payload.userId,
              title: payload.subject,
              message: payload.subject,
              type: payload.notificationType || "order_update",
              metadata: {
                idempotency_key: key,
                message_id: result.messageId,
                channel: "email",
                sent_at: new Date().toISOString(),
              },
            })
            .abortSignal(AbortSignal.timeout(500));
        } catch (dbErr: any) {
          console.warn("[Notifications] Failed to persist in-app bell record:", dbErr.message);
        }
      }
    }

    return { success: true, messageId: result.messageId, idempotencyKey: key };
  }

  // Record the failed send in the outbox too — the outbox pattern exists specifically to
  // give real visibility into failures, not just successes. `payload` preserves the exact
  // render inputs so the retry worker can actually resend this notification later, rather
  // than having a dead-letter row with nothing left to retry.
  try {
    await (supabaseAdmin.from("notifications") as any).insert({
      entity_type: payload.entityType ?? "notification",
      entity_id: payload.entityId ?? key,
      template_name: payload.notificationType || "GENERIC",
      channel: "email",
      recipient_email: payload.toEmail,
      status: "failed",
      error_message: result.error || "Failed to send email after retries",
      idempotency_key: key,
      payload: {
        toEmail: payload.toEmail,
        toName: payload.toName,
        subject: payload.subject,
        htmlContent: payload.htmlContent,
        userId: payload.userId,
      },
      attempts: 1,
    });
  } catch {
    // Non-blocking — do not let outbox logging failure mask the real send failure below.
  }

  return {
    success: false,
    idempotencyKey: key,
    error: result.error || "Failed to send email after retries",
  };
}

/**
 * Retry an existing failed outbox row in place — sends via Brevo directly (no idempotency
 * short-circuit, no new outbox insert) and returns the raw result for the caller to apply
 * to that same row. This is what jobs.ts's retry worker uses; it must NOT go through
 * sendTransactionalNotification, which always inserts a brand-new outbox row on success —
 * that would leave two rows (the updated original plus a fresh duplicate) for one logical
 * notification.
 */
export async function retryNotificationSend(payload: TransactionalEmailPayload): Promise<{
  success: boolean;
  messageId?: string | undefined;
  error?: string | undefined;
}> {
  const result = await dispatchViaBrevo(payload);
  return { success: result.success, messageId: result.messageId, error: result.error };
}

/**
 * 1. Send Order Confirmation Email + Tax Invoice (10% Australian GST & Marketplace ABN)
 */
export async function sendOrderConfirmationEmail(params: {
  customerEmail: string;
  customerName: string;
  masterOrderId: string;
  totalAmountAud: number;
  gstTotalAud: number;
  packageCount: number;
  idempotencyKey?: string | undefined;
  userId?: string | undefined;
}): Promise<NotificationSendResult> {
  const env = getServerEnv();
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
      <h1 style="color: #b91c1c; margin-bottom: 4px;">Indian Shopping Mela</h1>
      <p style="font-size: 13px; color: #6b7280; margin-top: 0;">Australia's Premier Indian Multi-Vendor Marketplace</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      
      <h2>Order Confirmation — #${params.masterOrderId}</h2>
      <p>Dear ${params.customerName},</p>
      <p>Thank you for shopping with us! Your payment of <strong>$${params.totalAmountAud.toFixed(2)} AUD</strong> has been successfully processed.</p>
      
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #111827;">Tax Invoice Summary</h3>
        <p style="margin: 4px 0;"><strong>Marketplace Operator:</strong> ${env.MARKETPLACE_LEGAL_NAME}</p>
        <p style="margin: 4px 0;"><strong>ABN:</strong> ${env.MARKETPLACE_ABN}</p>
        <p style="margin: 4px 0;"><strong>Total (GST Inclusive):</strong> $${params.totalAmountAud.toFixed(2)} AUD</p>
        <p style="margin: 4px 0;"><strong>Includes 10% Australian GST:</strong> $${params.gstTotalAud.toFixed(2)} AUD</p>
        <p style="margin: 4px 0;"><strong>Fulfillment:</strong> ${params.packageCount} seller package(s) dispatched separately.</p>
      </div>

      <p>Each independent seller will prepare and dispatch their items. You will receive real-time Australia Post/Sendle tracking links as packages ship.</p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">Australian Consumer Law (ACL) statutory protections & 7-day change-of-mind return policy apply upon delivery.</p>
    </div>
  `;

  return sendTransactionalNotification({
    toEmail: params.customerEmail,
    toName: params.customerName,
    subject: `Order Confirmed: #${params.masterOrderId} — Indian Shopping Mela Tax Invoice`,
    htmlContent,
    idempotencyKey: params.idempotencyKey || `order_confirm_${params.masterOrderId}`,
    userId: params.userId,
    notificationType: "ORDER_CONFIRMATION",
    entityType: "order",
    entityId: params.masterOrderId,
  });
}

/**
 * 2. Send Seller New Order Alert (with Dispatch SLA Countdown)
 */
export async function sendSellerNewOrderEmail(params: {
  sellerEmail: string;
  sellerBusinessName: string;
  subOrderId: string;
  itemCount: number;
  totalEarningsAud: number;
  deadlineHours: number;
  idempotencyKey?: string | undefined;
  sellerUserId?: string | undefined;
}): Promise<NotificationSendResult> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <h1 style="color: #b91c1c;">Indian Shopping Mela — Seller Centre</h1>
      <h2>New Order Received: #${params.subOrderId}</h2>
      <p>Dear ${params.sellerBusinessName},</p>
      <p>You have a new paid customer package containing <strong>${params.itemCount} item(s)</strong> awaiting fulfillment.</p>
      
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #991b1b;">Dispatch SLA Action Required</h3>
        <p style="margin: 4px 0;"><strong>Package ID:</strong> #${params.subOrderId}</p>
        <p style="margin: 4px 0;"><strong>Net Seller Settlement:</strong> $${params.totalEarningsAud.toFixed(2)} AUD</p>
        <p style="margin: 4px 0;"><strong>Handling SLA:</strong> Please accept and dispatch within <strong>${params.deadlineHours} hours</strong>.</p>
      </div>

      <p><a href="https://indianshoppingmela.com.au/sell/orders" style="background-color: #b91c1c; color: white; padding: 10px 18px; text-decoration: none; border-radius: 4px; display: inline-block;">Open Seller Centre Orders</a></p>
    </div>
  `;

  return sendTransactionalNotification({
    toEmail: params.sellerEmail,
    toName: params.sellerBusinessName,
    subject: `Action Required: New Order #${params.subOrderId} (${params.deadlineHours}h SLA) — ISM`,
    htmlContent,
    idempotencyKey: params.idempotencyKey || `seller_new_order_${params.subOrderId}`,
    userId: params.sellerUserId,
    notificationType: "SELLER_NEW_ORDER",
    entityType: "sub_order",
    entityId: params.subOrderId,
  });
}

/**
 * 3. Send Dispatch Deadline Reminder to Seller
 */
export async function sendDispatchDeadlineReminderEmail(params: {
  sellerEmail: string;
  sellerBusinessName: string;
  subOrderId: string;
  hoursRemaining: number;
  idempotencyKey?: string | undefined;
}): Promise<NotificationSendResult> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <h1 style="color: #b91c1c;">Indian Shopping Mela — Urgent Reminder</h1>
      <h2>Dispatch SLA Deadline Approaching: #${params.subOrderId}</h2>
      <p>Dear ${params.sellerBusinessName},</p>
      <p>Package <strong>#${params.subOrderId}</strong> has <strong>${params.hoursRemaining} hours remaining</strong> before the dispatch deadline expires.</p>
      <p>Please generate carrier labels and dispatch the parcel to maintain your seller performance rating.</p>
    </div>
  `;

  return sendTransactionalNotification({
    toEmail: params.sellerEmail,
    toName: params.sellerBusinessName,
    subject: `Urgent: ${params.hoursRemaining}h Remaining to Dispatch Order #${params.subOrderId}`,
    htmlContent,
    idempotencyKey:
      params.idempotencyKey || `deadline_remind_${params.subOrderId}_${params.hoursRemaining}h`,
    notificationType: "DISPATCH_DEADLINE_REMINDER",
    entityType: "sub_order",
    entityId: params.subOrderId,
  });
}

/**
 * 4. Send Package Shipped Notification + Carrier Tracking Link
 */
export async function sendPackageDispatchedEmail(params: {
  customerEmail: string;
  customerName: string;
  subOrderId: string;
  sellerBusinessName: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  idempotencyKey?: string | undefined;
  userId?: string | undefined;
}): Promise<NotificationSendResult> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <h1 style="color: #b91c1c;">Indian Shopping Mela</h1>
      <h2>Your Package is On Its Way! 📦</h2>
      <p>Dear ${params.customerName},</p>
      <p><strong>${params.sellerBusinessName}</strong> has packaged and shipped your items for package <strong>#${params.subOrderId}</strong>.</p>
      
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 4px 0;"><strong>Carrier:</strong> ${params.carrier}</p>
        <p style="margin: 4px 0;"><strong>Tracking Number:</strong> ${params.trackingNumber}</p>
        <p style="margin-top: 12px;"><a href="${params.trackingUrl}" style="background-color: #b91c1c; color: white; padding: 10px 18px; text-decoration: none; border-radius: 4px; display: inline-block;">Track Your Package Live</a></p>
      </div>
      
      <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">Once delivered, our standard 7-day change-of-mind return policy applies.</p>
    </div>
  `;

  return sendTransactionalNotification({
    toEmail: params.customerEmail,
    toName: params.customerName,
    subject: `Package Shipped: #${params.subOrderId} from ${params.sellerBusinessName}`,
    htmlContent,
    idempotencyKey: params.idempotencyKey || `shipped_${params.subOrderId}`,
    userId: params.userId,
    notificationType: "PACKAGE_SHIPPED",
    entityType: "sub_order",
    entityId: params.subOrderId,
  });
}

/**
 * 5. Send Package Delivered Notification (Anchoring 7-day Return Window)
 */
export async function sendPackageDeliveredEmail(params: {
  customerEmail: string;
  customerName: string;
  subOrderId: string;
  sellerBusinessName: string;
  deliveryTimestamp: string;
  idempotencyKey?: string | undefined;
  userId?: string | undefined;
}): Promise<NotificationSendResult> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <h1 style="color: #b91c1c;">Indian Shopping Mela</h1>
      <h2>Your Package Has Been Delivered! 🎉</h2>
      <p>Dear ${params.customerName},</p>
      <p>Carrier confirmation confirms package <strong>#${params.subOrderId}</strong> from <strong>${params.sellerBusinessName}</strong> was delivered on ${new Date(params.deliveryTimestamp).toLocaleDateString("en-AU")}.</p>
      
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #166534;">7-Day Change of Mind Window</h3>
        <p style="margin: 4px 0;">If you need to return an item, you have <strong>7 days</strong> from delivery to initiate a change-of-mind return through your account.</p>
      </div>

      <p><a href="https://indianshoppingmela.com.au/orders" style="background-color: #b91c1c; color: white; padding: 10px 18px; text-decoration: none; border-radius: 4px; display: inline-block;">View Order & Review Items</a></p>
    </div>
  `;

  return sendTransactionalNotification({
    toEmail: params.customerEmail,
    toName: params.customerName,
    subject: `Delivered: Package #${params.subOrderId} from ${params.sellerBusinessName}`,
    htmlContent,
    idempotencyKey: params.idempotencyKey || `delivered_${params.subOrderId}`,
    userId: params.userId,
    notificationType: "PACKAGE_DELIVERED",
    entityType: "sub_order",
    entityId: params.subOrderId,
  });
}

/**
 * 6. Send Return Updates (Creation / Label / Received)
 */
export async function sendReturnUpdateEmail(params: {
  recipientEmail: string;
  recipientName: string;
  returnId: string;
  status: string;
  returnReason: string;
  instructions: string;
  idempotencyKey?: string | undefined;
  userId?: string | undefined;
}): Promise<NotificationSendResult> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <h1 style="color: #b91c1c;">Indian Shopping Mela</h1>
      <h2>Return Update: #${params.returnId} (${params.status})</h2>
      <p>Dear ${params.recipientName},</p>
      <p>Your return request has been updated to status: <strong>${params.status}</strong>.</p>
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Reason:</strong> ${params.returnReason}</p>
        <p><strong>Instructions:</strong> ${params.instructions}</p>
      </div>
    </div>
  `;

  return sendTransactionalNotification({
    toEmail: params.recipientEmail,
    toName: params.recipientName,
    subject: `Return Update: #${params.returnId} — Status: ${params.status}`,
    htmlContent,
    idempotencyKey: params.idempotencyKey || `return_${params.returnId}_${params.status}`,
    userId: params.userId,
    notificationType: "RETURN_UPDATE",
    entityType: "return",
    entityId: params.returnId,
  });
}

/**
 * 7. Send Refund Confirmation Email
 */
export async function sendRefundConfirmationEmail(params: {
  customerEmail: string;
  customerName: string;
  orderId: string;
  refundAmountAud: number;
  reason: string;
  idempotencyKey?: string | undefined;
  userId?: string | undefined;
}): Promise<NotificationSendResult> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <h1 style="color: #b91c1c;">Indian Shopping Mela</h1>
      <h2>Refund Processed — $${params.refundAmountAud.toFixed(2)} AUD</h2>
      <p>Dear ${params.customerName},</p>
      <p>A refund of <strong>$${params.refundAmountAud.toFixed(2)} AUD</strong> has been issued to your original payment method for Order <strong>#${params.orderId}</strong>.</p>
      <p><strong>Reason:</strong> ${params.reason}</p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">Depending on your Australian card issuer, refunds typically appear on your statement within 3–5 business days.</p>
    </div>
  `;

  return sendTransactionalNotification({
    toEmail: params.customerEmail,
    toName: params.customerName,
    subject: `Refund Confirmed: $${params.refundAmountAud.toFixed(2)} AUD for Order #${params.orderId}`,
    htmlContent,
    idempotencyKey: params.idempotencyKey || `refund_${params.orderId}_${params.refundAmountAud}`,
    userId: params.userId,
    notificationType: "REFUND_CONFIRMED",
    entityType: "order",
    entityId: params.orderId,
  });
}

/**
 * 8. Send Seller Payout Settlement Notification
 */
export async function sendSellerPayoutEmail(params: {
  sellerEmail: string;
  sellerBusinessName: string;
  payoutId: string;
  transferAmountAud: number;
  itemCount: number;
  idempotencyKey?: string | undefined;
  sellerUserId?: string | undefined;
}): Promise<NotificationSendResult> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <h1 style="color: #b91c1c;">Indian Shopping Mela — Seller Centre</h1>
      <h2>Stripe Connect Payout Sent — $${params.transferAmountAud.toFixed(2)} AUD</h2>
      <p>Dear ${params.sellerBusinessName},</p>
      <p>Your matured 14-day clearance earnings of <strong>$${params.transferAmountAud.toFixed(2)} AUD</strong> covering <strong>${params.itemCount} delivered order(s)</strong> have been transferred to your Stripe Connect Express account.</p>
      <p><strong>Payout Ref:</strong> #${params.payoutId}</p>
      <p><a href="https://indianshoppingmela.com.au/sell/payouts" style="background-color: #b91c1c; color: white; padding: 10px 18px; text-decoration: none; border-radius: 4px; display: inline-block;">Download Payout Statement</a></p>
    </div>
  `;

  return sendTransactionalNotification({
    toEmail: params.sellerEmail,
    toName: params.sellerBusinessName,
    subject: `Payout Settled: $${params.transferAmountAud.toFixed(2)} AUD via Stripe Connect — ISM`,
    htmlContent,
    idempotencyKey: params.idempotencyKey || `payout_${params.payoutId}`,
    userId: params.sellerUserId,
    notificationType: "SELLER_PAYOUT_SETTLED",
    entityType: "payout",
    entityId: params.payoutId,
  });
}

/**
 * 9. Send Seller Staff Team Invite Email
 */
export async function sendSellerStaffInviteEmail(params: {
  inviteeEmail: string;
  inviteeName: string;
  sellerBusinessName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiresInDays: number;
  idempotencyKey?: string | undefined;
}): Promise<NotificationSendResult> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
      <h1 style="color: #b91c1c;">Indian Shopping Mela — Seller Centre</h1>
      <h2>You've Been Invited to Join a Seller Team</h2>
      <p>Dear ${params.inviteeName || "there"},</p>
      <p><strong>${params.inviterName}</strong> has invited you to join <strong>${params.sellerBusinessName}</strong>'s seller team on Indian Shopping Mela as a <strong>${params.role}</strong>.</p>
      <p><a href="${params.acceptUrl}" style="background-color: #b91c1c; color: white; padding: 10px 18px; text-decoration: none; border-radius: 4px; display: inline-block;">Accept Invitation</a></p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">This invitation expires in ${params.expiresInDays} days. If you did not expect this invitation, you can safely ignore this email.</p>
    </div>
  `;

  return sendTransactionalNotification({
    toEmail: params.inviteeEmail,
    toName: params.inviteeName || params.inviteeEmail,
    subject: `You're invited to join ${params.sellerBusinessName} on Indian Shopping Mela`,
    htmlContent,
    idempotencyKey: params.idempotencyKey,
    notificationType: "SELLER_STAFF_INVITE",
    entityType: "seller_staff_invite",
    entityId: params.acceptUrl,
  });
}

/**
 * Server Functions for in-app client retrieval
 */
export const getUserNotificationsServerFn = createServerFn({ method: "POST" }).handler(
  async () => {
    // In-app bell notifications live in user_notifications, not notifications
    // (the latter is the outbound send-log/outbox and has no user_id column at all).
    // Verified session is authoritative — a client-supplied userId would let anyone
    // read another user's notification history (order/return/payout content).
    const verifiedUserId = await getVerifiedSessionUserId();
    if (!verifiedUserId) {
      throw new Error("UNAUTHORIZED: Sign in to view your notifications.");
    }
    const { data: notifs, error } = await (supabaseAdmin.from("user_notifications") as any)
      .select("*")
      .eq("user_id", verifiedUserId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) return [];
    return notifs || [];
  },
);

export const markNotificationReadServerFn = createServerFn({ method: "POST" })
  .validator((data: { notificationId: string }) => data)
  .handler(async ({ data }) => {
    const verifiedUserId = await getVerifiedSessionUserId();
    if (!verifiedUserId) {
      throw new Error("UNAUTHORIZED: Sign in to update your notifications.");
    }
    await (supabaseAdmin.from("user_notifications") as any)
      .update({ is_read: true })
      .eq("id", data.notificationId)
      .eq("user_id", verifiedUserId);

    return { success: true };
  });

// Compatibility export
export const sendOrderConfirmationEmailServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      customerEmail: string;
      customerName: string;
      masterOrderId: string;
      totalAmountAud: number;
      gstTotalAud: number;
      packageCount: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    // Unauthenticated callers could otherwise use this to send unlimited freeform
    // "order confirmed" emails, impersonating ISM, to any address via the marketplace's
    // own Brevo account — real order emails are triggered server-side from the Stripe
    // webhook, not by a directly client-callable RPC.
    await requireAdminSession();
    const res = await sendOrderConfirmationEmail(data);
    return res.success;
  });

export const sendPackageDispatchedEmailServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      customerEmail: string;
      customerName: string;
      subOrderId: string;
      sellerBusinessName: string;
      carrier: string;
      trackingNumber: string;
      trackingUrl: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAdminSession();
    const res = await sendPackageDispatchedEmail(data);
    return res.success;
  });
