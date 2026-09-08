import { supabaseAdmin } from "@/lib/supabase/server";

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  uptimeSeconds: number;
  environment: string;
  version: string;
  timestamp: string;
  region: string;
  checks: {
    database: {
      status: "pass" | "warn" | "fail";
      latencyMs: number;
      error?: string | undefined;
    };
    storage: {
      status: "pass" | "warn" | "fail";
      latencyMs: number;
      error?: string | undefined;
    };
    memory: {
      heapUsedMb: number;
      heapTotalMb: number;
      rssMb: number;
    };
  };
}

const processStartTime = Date.now();

/**
 * Performs a comprehensive system health evaluation including PostgreSQL connection latency,
 * Supabase Storage reachability, and memory utilization.
 */
export async function performDeepHealthCheck(): Promise<HealthCheckResult> {
  const env = process.env["NODE_ENV"] ?? "development";
  let dbStatus: "pass" | "warn" | "fail" = "pass";
  let dbLatencyMs = 0;
  let dbError: string | undefined;

  let storageStatus: "pass" | "warn" | "fail" = "pass";
  let storageLatencyMs = 0;
  let storageError: string | undefined;

  // 1. Evaluate database connection & query latency
  const dbStart = Date.now();
  try {
    const { error } = await supabaseAdmin.from("marketplace_configs").select("key").limit(1);
    dbLatencyMs = Date.now() - dbStart;
    if (error) {
      dbStatus = "warn";
      dbError = error.message;
    } else if (dbLatencyMs > 500) {
      dbStatus = "warn";
      dbError = `High latency: ${dbLatencyMs}ms`;
    }
  } catch (err: any) {
    dbLatencyMs = Date.now() - dbStart;
    dbStatus = "fail";
    dbError = err?.message ?? "Database connection failed";
  }

  // 2. Evaluate storage reachability
  const storageStart = Date.now();
  try {
    const { error } = await supabaseAdmin.storage.from("product-media").list("", { limit: 1 });
    storageLatencyMs = Date.now() - storageStart;
    if (error) {
      storageStatus = "warn";
      storageError = error.message;
    }
  } catch (err: any) {
    storageLatencyMs = Date.now() - storageStart;
    storageStatus = "warn";
    storageError = err?.message ?? "Storage bucket list query failed";
  }

  // 3. Memory statistics
  let memoryStats = { heapUsedMb: 0, heapTotalMb: 0, rssMb: 0 };
  if (typeof process !== "undefined" && process.memoryUsage) {
    const mem = process.memoryUsage();
    memoryStats = {
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      rssMb: Math.round(mem.rss / 1024 / 1024),
    };
  }

  // Determine overall status
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (dbStatus === "fail") {
    overallStatus = "unhealthy";
  } else if (dbStatus === "warn" || storageStatus === "warn") {
    overallStatus = "degraded";
  }

  return {
    status: overallStatus,
    uptimeSeconds: Math.floor((Date.now() - processStartTime) / 1000),
    environment: env,
    version: "2026.09.0-prod",
    timestamp: new Date().toISOString(),
    region: "ap-southeast-2",
    checks: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        error: dbError,
      },
      storage: {
        status: storageStatus,
        latencyMs: storageLatencyMs,
        error: storageError,
      },
      memory: memoryStats,
    },
  };
}
