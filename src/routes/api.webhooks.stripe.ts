import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/server";
import { confirmOrderPaymentSuccess } from "@/lib/api/checkout";

const stripeSecret = process.env["STRIPE_SECRET_KEY"] ?? "sk_test_placeholder";
const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2025-02-24.acacia" as any,
});

export const handleStripeWebhookServerFn = createServerFn({ method: "POST" })
  .validator((data: { rawBody: string; signature?: string }) => data)
  .handler(async ({ data }) => {
    let event: Stripe.Event;

    if (webhookSecret && data.signature) {
      try {
        event = stripe.webhooks.constructEvent(data.rawBody, data.signature, webhookSecret);
      } catch (err: any) {
        console.error("Stripe webhook signature verification failed:", err.message);
        throw new Error(`Webhook Error: ${err.message}`);
      }
    } else {
      try {
        event = JSON.parse(data.rawBody);
      } catch (e: any) {
        throw new Error("Invalid JSON payload");
      }
    }

    // 1. Idempotency Check
    const { data: existingEvent } = await (supabaseAdmin.from("webhook_events") as any)
      .select("id, status")
      .eq("provider", "STRIPE")
      .eq("provider_event_id", event.id)
      .maybeSingle();

    if (existingEvent && existingEvent.status === "COMPLETED") {
      return { received: true, note: "Already processed" };
    }

    // 2. Record Event in Webhook Log
    await (supabaseAdmin.from("webhook_events") as any).upsert({
      provider: "STRIPE",
      provider_event_id: event.id,
      event_type: event.type,
      payload: event as any,
      signature_verified: !!webhookSecret,
      status: "PROCESSING",
    });

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await confirmOrderPaymentSuccess(paymentIntent.id);
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await (supabaseAdmin.from("payments") as any)
            .update({
              status: "FAILED",
              error_message: paymentIntent.last_payment_error?.message ?? "Payment failed",
              updated_at: new Date().toISOString(),
            })
            .eq("provider_payment_id", paymentIntent.id);
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object as Stripe.Charge;
          if (charge.payment_intent) {
            await (supabaseAdmin.from("payments") as any)
              .update({ status: "REFUNDED", updated_at: new Date().toISOString() })
              .eq("provider_payment_id", charge.payment_intent as string);
          }
          break;
        }

        default:
          break;
      }

      await (supabaseAdmin.from("webhook_events") as any)
        .update({ status: "COMPLETED", processed_at: new Date().toISOString() })
        .eq("provider", "STRIPE")
        .eq("provider_event_id", event.id);

      return { received: true };
    } catch (processError: any) {
      console.error("Error processing Stripe webhook event:", processError);
      await (supabaseAdmin.from("webhook_events") as any)
        .update({ status: "FAILED", last_error: processError.message })
        .eq("provider", "STRIPE")
        .eq("provider_event_id", event.id);

      throw processError;
    }
  });

export const Route = createFileRoute("/api/webhooks/stripe")({
  component: () => null,
});
