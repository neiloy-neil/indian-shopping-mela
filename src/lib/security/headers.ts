/**
 * Security Headers & Content Security Policy (CSP) Configuration
 * Australian Multi-Vendor Marketplace (Indian Shopping Mela)
 */

export const CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://js.stripe.com",
    "https://cdn.jsdelivr.net",
  ],
  "style-src": [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
  ],
  "font-src": [
    "'self'",
    "https://fonts.gstatic.com",
    "data:",
  ],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "https:",
    "https://images.unsplash.com",
    "https://*.supabase.co",
    "https://image.mux.com",
  ],
  "media-src": [
    "'self'",
    "blob:",
    "https:",
    "https://stream.mux.com",
    "https://image.mux.com",
    "https://*.supabase.co",
  ],
  "connect-src": [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://api.stripe.com",
    "https://*.mux.com",
    "https://api.brevo.com",
    "https://digitalapi.auspost.com.au",
  ],
  "frame-src": [
    "'self'",
    "https://js.stripe.com",
    "https://hooks.stripe.com",
  ],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "upgrade-insecure-requests": [],
};

/**
 * Generate formatted Content Security Policy string
 */
export function buildCspHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, sources]) => {
      if (sources.length === 0) return directive;
      return `${directive} ${sources.join(" ")}`;
    })
    .join("; ");
}

/**
 * Apply hardened production security headers to HTTP Response
 */
export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  // 1. Content Security Policy
  headers.set("Content-Security-Policy", buildCspHeader());

  // 2. Prevent MIME type sniffing
  headers.set("X-Content-Type-Options", "nosniff");

  // 3. Clickjacking protection (DENY frame embedding)
  headers.set("X-Frame-Options", "DENY");

  // 4. Cross-site scripting filter
  headers.set("X-XSS-Protection", "1; mode=block");

  // 5. Referrer Policy
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // 6. Restrictive Permissions Policy
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), payment=(self \"https://js.stripe.com\")"
  );

  // 7. Strict Transport Security (HSTS) — 2 years + subdomains + preload
  headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // 8. Cross-Origin Embedder and Resource Policies
  headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
