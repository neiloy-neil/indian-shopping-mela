import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/supabase/server";

export const Route = createFileRoute("/api/health")({
  loader: async () => {
    let dbStatus = "connected";
    let dbLatencyMs = 0;
    let dbError: string | null = null;

    const start = Date.now();
    try {
      const { error } = await supabaseAdmin.from("marketplace_configs").select("key").limit(1);
      dbLatencyMs = Date.now() - start;
      if (error) {
        dbStatus = "degraded";
        dbError = error.message;
      }
    } catch (e: any) {
      dbLatencyMs = Date.now() - start;
      dbStatus = "unreachable";
      dbError = e?.message ?? "Database query exception";
    }

    return {
      status: dbStatus === "connected" ? "healthy" : "degraded",
      version: "2026.09.0-prod",
      environment: process.env["NODE_ENV"] ?? "development",
      region: "ap-southeast-2",
      service: "Indian Shopping Mela API",
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        error: dbError,
      },
      timestamp: new Date().toISOString(),
    };
  },
  component: () => null,
});
