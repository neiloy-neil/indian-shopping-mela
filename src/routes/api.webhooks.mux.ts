import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyMuxWebhookSignature } from "@/lib/api/video";

const muxWebhookSecret = process.env["MUX_WEBHOOK_SECRET"] ?? "";
const isProduction = process.env["NODE_ENV"] === "production";

export const handleMuxWebhookServerFn = createServerFn({ method: "POST" })
  .validator((data: { rawBody: string; signature?: string | undefined }) => data)
  .handler(async ({ data }) => {
    // 1. Fail-closed signature verification in production
    const isVerified = verifyMuxWebhookSignature(data.rawBody, data.signature, muxWebhookSecret);

    if (!isVerified) {
      if (isProduction || muxWebhookSecret) {
        throw new Error("Invalid or missing Mux webhook signature");
      }
    }

    let event: any;
    try {
      event = JSON.parse(data.rawBody);
    } catch {
      throw new Error("Invalid JSON payload");
    }

    const eventId = event.id ?? `mux_${Date.now()}`;
    const eventType = event.type ?? "unknown";

    // 2. Webhook Idempotency Check
    const { data: existingEvent } = await (supabaseAdmin.from("webhook_events") as any)
      .select("id, status")
      .eq("provider", "MUX")
      .eq("provider_event_id", eventId)
      .maybeSingle();

    if (existingEvent && existingEvent.status === "COMPLETED") {
      return { received: true, note: "Event already processed idempotently" };
    }

    // 3. Persist Webhook Event in PROCESSING state
    await (supabaseAdmin.from("webhook_events") as any).upsert({
      provider: "MUX",
      provider_event_id: eventId,
      event_type: eventType,
      payload: event,
      signature_verified: isVerified,
      status: "PROCESSING",
    });

    try {
      // 4. Handle Mux Event Types
      if (eventType === "video.asset.ready") {
        const assetId = event.data?.id;
        const playbackId = event.data?.playback_ids?.[0]?.id;
        const duration = event.data?.duration;

        if (assetId && playbackId) {
          // Update product_media matching this asset or passthrough ID
          const passthrough = event.data?.passthrough; // Can store productId
          if (passthrough) {
            await (supabaseAdmin.from("product_media") as any)
              .update({
                url: `https://stream.mux.com/${playbackId}.m3u8`,
                alt_text: "Product demonstration video (Ready)",
              })
              .eq("product_id", passthrough)
              .eq("media_type", "video");
          }
        }
      } else if (eventType === "video.asset.errored") {
        const passthrough = event.data?.passthrough;
        if (passthrough) {
          // Remove or mark failed video so it is never displayed
          await (supabaseAdmin.from("product_media") as any)
            .delete()
            .eq("product_id", passthrough)
            .eq("media_type", "video");
        }
      }

      // 5. Mark webhook completed
      await (supabaseAdmin.from("webhook_events") as any)
        .update({ status: "COMPLETED", processed_at: new Date().toISOString() })
        .eq("provider", "MUX")
        .eq("provider_event_id", eventId);

      return { received: true, status: "PROCESSED" };
    } catch (err: any) {
      await (supabaseAdmin.from("webhook_events") as any)
        .update({
          status: "FAILED",
          error_message: err.message,
          processed_at: new Date().toISOString(),
        })
        .eq("provider", "MUX")
        .eq("provider_event_id", eventId);

      throw err;
    }
  });

export const Route = createFileRoute("/api/webhooks/mux")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("mux-signature") ?? undefined;

        try {
          const result = await handleMuxWebhookServerFn({
            data: { rawBody, signature },
          });
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
