import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/supabase/server";

export const Route = createFileRoute("/api/health")({
  loader: async () => {
    let dbStatus = "connected";
    let dbError: string | null = null;

    try {
      const { error } = await supabaseAdmin.from("marketplace_configs").select("key").limit(1);
      if (error) {
        dbStatus = "error";
        dbError = error.message;
      }
    } catch (e: any) {
      dbStatus = "unreachable";
      dbError = e.message;
    }

    return {
      status: dbStatus === "connected" ? "healthy" : "degraded",
      region: "ap-southeast-2",
      service: "Indian Shopping Mela API",
      database: dbStatus,
      error: dbError,
      timestamp: new Date().toISOString(),
    };
  },
  component: () => null,
});
