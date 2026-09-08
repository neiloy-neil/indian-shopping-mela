import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { commitInventoryReservations, releaseInventoryReservations } from "@/lib/api/inventory";
import { sendOrderConfirmationEmail } from "@/lib/api/notifications";

const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";
const isProduction = process.env["NODE_ENV"] === "production";

export const handleStripeWebhookServerFn = createServerFn({ method: "POST" })
  .validator((data: { rawBody: string; signature?: string }) => data)
  .handler(async ({ data }) => {
    let event: Stripe.Event;

    // Fail-closed signature verification in production
    if (webhookSecret && data.signature) {
      try {
        event = stripe.webhooks.constructEvent(data.rawBody, data.signature, webhookSecret);
      } catch (err: any) {
        console.error("Stripe webhook signature verification failed:", err.message);
        throw new Error(`Webhook Error: ${err.message}`);
      }
    } else {
      if (isProduction) {
        throw new Error("Missing Stripe webhook signature in production environment.");
      }
      try {
        event = JSON.parse(data.rawBody);
      } catch (e: any) {
        throw new Error("Invalid JSON payload");
      }
    }

    // 1. Webhook Idempotency Check: Avoid duplicate processing
    const { data: existingEvent } = await (supabaseAdmin.from("webhook_events") as any)
      .select("id, status")
      .eq("provider", "STRIPE")
      .eq("provider_event_id", event.id)
      .maybeSingle();

    if (existingEvent && existingEvent.status === "COMPLETED") {
      return { received: true, note: "Event already processed idempotently" };
    }

    // 2. Persist Unique Webhook Event in PROCESSING state before business action
    await (supabaseAdmin.from("webhook_events") as any).upsert({
      provider: "STRIPE",
      provider_event_id: event.id,
      event_type: event.type,
      payload: event as any,
      signature_verified: !!webhookSecret && !!data.signature,
      status: "PROCESSING",
    });

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          // Find payment and order records
          const { data: payment } = await (supabaseAdmin.from("payments") as any)
            .select("id, order_id, amount_cents")
            .eq("provider_payment_id", paymentIntent.id)
            .maybeSingle();

          if (payment) {
            // Update Payment Status
            await (supabaseAdmin.from("payments") as any)
              .update({
                status: "PAID",
                payment_method_type: paymentIntent.payment_method_types?.[0] ?? "card",
                updated_at: new Date().toISOString(),
              })
              .eq("id", payment.id);

            // Update Master Order Status
            await (supabaseAdmin.from("orders") as any)
              .update({
                status: "CONFIRMED",
                payment_status: "PAID",
                payment_authorized_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", payment.order_id);

            // Fetch Sub-Orders for this Master Order
            const { data: subOrders } = await (supabaseAdmin.from("sub_orders") as any)
              .select("id, seller_id, shipping_cost")
              .eq("master_order_id", payment.order_id);

            // Ensure Sub-Orders are set to NEW_ORDER (sellers must accept manually)
            await (supabaseAdmin.from("sub_orders") as any)
              .update({
                status: "NEW_ORDER",
                updated_at: new Date().toISOString(),
              })
              .eq("master_order_id", payment.order_id);

            // Commit atomic inventory reservations for this order
            const sessionId = paymentIntent.metadata?.["sessionId"] ?? paymentIntent.id;
            await commitInventoryReservations(sessionId, payment.order_id);

            // Append canonical immutable double-entry ledger records
            const orderAmountCents = payment.amount_cents || paymentIntent.amount;
            const gstAmountCents = Math.round(orderAmountCents / 11);

            // Record Customer Payment (Gross Received)
            await (supabaseAdmin.from("ledger_entries") as any).insert({
              order_id: payment.order_id,
              entry_type: "CUSTOMER_PAYMENT",
              amount_cents: orderAmountCents,
              currency: "AUD",
              description: `Customer payment received for Order #${payment.order_id}`,
            });

            // Record GST Remittance liability
            await (supabaseAdmin.from("ledger_entries") as any).insert({
              order_id: payment.order_id,
              entry_type: "GST_REMITTANCE",
              amount_cents: gstAmountCents,
              currency: "AUD",
              description: `1/11th Australian GST component on Order #${payment.order_id}`,
            });

            // Record platform commission and seller credit per sub-order
            if (subOrders && subOrders.length > 0) {
              for (const sub of subOrders) {
                const commissionRatePct = 12.0;
                const subGrossCents = Math.round(orderAmountCents / subOrders.length);
                const commissionCents = Math.round((subGrossCents * commissionRatePct) / 100);

                await (supabaseAdmin.from("ledger_entries") as any).insert({
                  order_id: payment.order_id,
                  sub_order_id: sub.id,
                  seller_id: sub.seller_id,
                  entry_type: "PLATFORM_COMMISSION",
                  amount_cents: commissionCents,
                  currency: "AUD",
                  description: `12% marketplace commission on Sub-Order #${sub.id}`,
                });
              }
            }

            // Dispatch Customer Order Confirmation + Tax Invoice Email (Idempotent)
            try {
              const { data: orderDetails } = await (supabaseAdmin.from("orders") as any)
                .select("id, user_id, customer_email, shipping_address")
                .eq("id", payment.order_id)
                .maybeSingle();

              const customerEmail = orderDetails?.customer_email || paymentIntent.receipt_email || paymentIntent.metadata?.["customer_email"];
              const customerName = orderDetails?.shipping_address?.full_name || "Valued Customer";

              if (customerEmail) {
                await sendOrderConfirmationEmail({
                  customerEmail,
                  customerName,
                  masterOrderId: payment.order_id,
                  totalAmountAud: orderAmountCents / 100,
                  gstTotalAud: gstAmountCents / 100,
                  packageCount: subOrders?.length || 1,
                  idempotencyKey: `order_confirm_${payment.order_id}`,
                  userId: orderDetails?.user_id,
                });
              }
            } catch (emailErr: any) {
              console.warn("[Stripe Webhook] Order confirmation email non-blocking notice:", emailErr.message);
            }
          }
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const { data: payment } = await (supabaseAdmin.from("payments") as any)
            .select("id, order_id")
            .eq("provider_payment_id", paymentIntent.id)
            .maybeSingle();

          if (payment) {
            await (supabaseAdmin.from("payments") as any)
              .update({
                status: "FAILED",
                updated_at: new Date().toISOString(),
              })
              .eq("id", payment.id);

            await (supabaseAdmin.from("orders") as any)
              .update({
                payment_status: "FAILED",
                updated_at: new Date().toISOString(),
              })
              .eq("id", payment.order_id);

            // Release inventory holds on failed payment
            const sessionId = paymentIntent.metadata?.["sessionId"];
            if (sessionId) {
              await releaseInventoryReservations(sessionId).catch(console.warn);
            }
          }
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object as Stripe.Charge;
          if (charge.payment_intent) {
            const { data: payment } = await (supabaseAdmin.from("payments") as any)
              .select("id, order_id")
              .eq("provider_payment_id", charge.payment_intent as string)
              .maybeSingle();

            if (payment) {
              const refundAmountCents = charge.amount_refunded || 0;

              await (supabaseAdmin.from("payments") as any)
                .update({
                  status: charge.refunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", payment.id);

              await (supabaseAdmin.from("orders") as any)
                .update({
                  payment_status: charge.refunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", payment.order_id);

              // Post compensating refund ledger entries
              await (supabaseAdmin.from("ledger_entries") as any).insert({
                order_id: payment.order_id,
                entry_type: "REFUND_CUSTOMER",
                amount_cents: refundAmountCents,
                currency: "AUD",
                description: `Customer refund for Order #${payment.order_id}`,
              });
            }
          }
          break;
        }

        case "charge.dispute.created": {
          const dispute = event.data.object as Stripe.Dispute;
          if (dispute.charge) {
            const { data: payment } = await (supabaseAdmin.from("payments") as any)
              .select("id, order_id")
              .eq("provider_payment_id", dispute.charge as string)
              .maybeSingle();

            if (payment) {
              // Post dispute hold ledger entry
              await (supabaseAdmin.from("ledger_entries") as any).insert({
                order_id: payment.order_id,
                entry_type: "DISPUTE_HOLD",
                amount_cents: dispute.amount || 0,
                currency: "AUD",
                description: `Dispute hold initiated by cardholder (${dispute.reason})`,
              });
            }
          }
          break;
        }

        default:
          break;
      }

      // 3. Mark Webhook Event COMPLETED
      await (supabaseAdmin.from("webhook_events") as any)
        .update({
          status: "COMPLETED",
          processed_at: new Date().toISOString(),
        })
        .eq("provider", "STRIPE")
        .eq("provider_event_id", event.id);

      return { received: true };
    } catch (processError: any) {
      console.error("Error processing Stripe webhook event:", processError);
      await (supabaseAdmin.from("webhook_events") as any)
        .update({
          status: "FAILED",
          last_error: processError.message,
        })
        .eq("provider", "STRIPE")
        .eq("provider_event_id", event.id);

      throw processError;
    }
  });

export const Route = createFileRoute("/api/webhooks/stripe")({
  component: () => null,
});

