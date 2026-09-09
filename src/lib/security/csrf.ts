/**
 * CSRF Protection Strategy for Cookie-Authenticated Mutations
 */

export const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://indianshoppingmela.com.au",
  "https://www.indianshoppingmela.com.au",
  "https://staging.indianshoppingmela.com.au",
];

export interface CsrfValidationResult {
  valid: boolean;
  reason?: string | undefined;
}

/**
 * Validate incoming request origin and custom headers against CSRF attacks
 */
export function validateCsrf(
  origin?: string | null,
  referer?: string | null,
  secFetchSite?: string | null,
  customHeader?: string | null,
): CsrfValidationResult {
  // 1. If Sec-Fetch-Site is present, reject cross-site requests
  if (secFetchSite && secFetchSite === "cross-site") {
    return { valid: false, reason: "Cross-site request blocked by Sec-Fetch-Site" };
  }

  // 2. Verify Origin header if present
  if (origin) {
    try {
      const originUrl = new URL(origin).origin;
      const isAllowed =
        ALLOWED_ORIGINS.some((allowed) => allowed === originUrl) ||
        originUrl.endsWith(".indianshoppingmela.com.au");

      if (!isAllowed) {
        return { valid: false, reason: `Unauthorized origin: ${origin}` };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: "Malformed origin header" };
    }
  }

  // 3. Verify Referer header if Origin is absent
  if (referer) {
    try {
      const refererUrl = new URL(referer).origin;
      const isAllowed =
        ALLOWED_ORIGINS.some((allowed) => allowed === refererUrl) ||
        refererUrl.endsWith(".indianshoppingmela.com.au");

      if (!isAllowed) {
        return { valid: false, reason: `Unauthorized referer: ${referer}` };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: "Malformed referer header" };
    }
  }

  // 4. Custom header check for AJAX/API requests
  if (customHeader) {
    return { valid: true };
  }

  // Default allow for same-origin browser navigations if no conflicting cross-origin headers
  return { valid: true };
}
