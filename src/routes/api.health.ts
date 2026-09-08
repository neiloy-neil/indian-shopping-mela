import { createFileRoute } from "@tanstack/react-router";
import { performDeepHealthCheck } from "@/lib/monitoring/uptime";

export const Route = createFileRoute("/api/health")({
  loader: async () => {
    return await performDeepHealthCheck();
  },
  component: () => null,
});

