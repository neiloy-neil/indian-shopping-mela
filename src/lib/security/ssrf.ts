/**
 * Server-Side Request Forgery (SSRF) Defense for Remote Media & Webhooks
 */

// Private & reserved IP range regular expressions
const PRIVATE_IP_PATTERNS = [
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 127.0.0.0/8 Loopback
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 10.0.0.0/8 Private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/, // 172.16.0.0/12 Private
  /^192\.168\.\d{1,3}\.\d{1,3}$/, // 192.168.0.0/16 Private
  /^169\.254\.\d{1,3}\.\d{1,3}$/, // 169.254.0.0/16 Link-local / Cloud Metadata
  /^0\.0\.0\.0$/, // Any local address
  /^::1$/, // IPv6 Loopback
  /^fc00:/i, // IPv6 Unique Local
  /^fe80:/i, // IPv6 Link-Local
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "instance-data",
  "metadata.google.internal",
  "169.254.169.254",
]);

export interface SsrfValidationResult {
  safe: boolean;
  reason?: string | undefined;
}

/**
 * Validate a remote URL to prevent SSRF vulnerabilities
 */
export function validateRemoteUrl(
  rawUrl: string,
  allowHttpForTesting: boolean = false,
): SsrfValidationResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { safe: false, reason: "Missing or invalid URL parameter" };
  }

  try {
    const parsed = new URL(rawUrl.trim());

    // 1. Enforce HTTPS (except explicit test environment override)
    if (parsed.protocol !== "https:" && (!allowHttpForTesting || parsed.protocol !== "http:")) {
      return { safe: false, reason: `Insecure protocol '${parsed.protocol}'. HTTPS required.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. Check blocked hostnames
    if (BLOCKED_HOSTNAMES.has(hostname)) {
      return { safe: false, reason: `Access to blocked host '${hostname}' is prohibited.` };
    }

    // 3. Check private / reserved IP addresses
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { safe: false, reason: `Access to private network IP '${hostname}' is prohibited.` };
      }
    }

    // 4. Disallow embedded credentials in URL (user:pass@host)
    if (parsed.username || parsed.password) {
      return { safe: false, reason: "URLs with embedded credentials are not allowed." };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: "Malformed URL." };
  }
}
