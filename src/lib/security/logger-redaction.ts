/**
 * Log Redaction & PII / Secret Sanitization Engine
 */

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /authorization/i,
  /cookie/i,
  /cvv/i,
  /cvc/i,
  /card_?number/i,
  /account_?number/i,
  /bsb/i,
  /bank_?account/i,
];

const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;
const CVV_REGEX = /\b\d{3,4}\b/g;
const BSB_REGEX = /\b\d{3}-\d{3}\b/g;

/**
 * Mask string value leaving only last 4 characters visible
 */
export function maskSensitiveString(value: string): string {
  if (!value || typeof value !== "string") return "[REDACTED]";
  if (value.length <= 4) return "****";
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}

/**
 * Strips secrets, credit cards, and tokens from a string for logging
 */
export function sanitizeForLogging(value: string): string {
  if (!value || typeof value !== "string") return "";
  let cleaned = value.replace(CREDIT_CARD_REGEX, "[CARD_REDACTED]");
  cleaned = cleaned.replace(BSB_REGEX, "[BSB_REDACTED]");
  return cleaned;
}

/**
 * Recursively redact sensitive fields from an object or array
 */
export function redactSensitiveData(data: any, depth: number = 0): any {
  if (depth > 8) return "[MAX_DEPTH_REACHED]";
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    // Redact credit card patterns in string
    let cleaned = data.replace(CREDIT_CARD_REGEX, "[CARD_REDACTED]");
    // Redact BSB patterns in string
    cleaned = cleaned.replace(BSB_REGEX, "[BSB_REDACTED]");
    return cleaned;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof data === "object") {
    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitiveKey) {
        if (typeof value === "string") {
          redacted[key] = maskSensitiveString(value);
        } else {
          redacted[key] = "[REDACTED]";
        }
      } else {
        redacted[key] = redactSensitiveData(value, depth + 1);
      }
    }
    return redacted;
  }

  return data;
}

/**
 * Safe console logger with automatic secret redaction
 */
export const safeLogger = {
  info(...args: any[]): void {
    console.log(...args.map((arg) => redactSensitiveData(arg)));
  },
  warn(...args: any[]): void {
    console.warn(...args.map((arg) => redactSensitiveData(arg)));
  },
  error(...args: any[]): void {
    console.error(...args.map((arg) => redactSensitiveData(arg)));
  },
};
