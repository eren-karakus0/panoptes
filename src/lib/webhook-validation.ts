import { lookup } from "dns/promises";
import { WEBHOOK_EVENTS, WEBHOOK_DEFAULTS } from "@/lib/constants";

interface WebhookCreateResult {
  name: string;
  url: string;
  events: string[];
}

interface WebhookUpdateResult {
  name?: string;
  url?: string;
  events?: string[];
  isActive?: boolean;
}

interface ValidationError {
  error: string;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "metadata.google.internal",
  "metadata.google",
]);

/** Check if a resolved IPv4 address is private/internal */
export function isBlockedIpv4(ip: string): boolean {
  if (ip.startsWith("127.")) return true;       // loopback 127.0.0.0/8
  if (ip.startsWith("10.")) return true;         // RFC 1918
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true; // RFC 1918
  if (ip.startsWith("192.168.")) return true;    // RFC 1918
  if (ip.startsWith("169.254.")) return true;    // link-local
  if (ip === "0.0.0.0") return true;             // unspecified
  return false;
}

/** Check if a resolved IPv6 address is private/internal */
export function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;              // loopback
  if (lower.startsWith("fe80:")) return true;    // link-local
  if (/^f[cd]/i.test(lower)) return true;        // ULA (fc00::/7)
  // IPv4-mapped IPv6 — dotted form (::ffff:127.0.0.1)
  if (lower.startsWith("::ffff:") && lower.includes(".")) {
    return isBlockedIpv4(lower.slice(7));
  }
  // IPv4-mapped IPv6 — hex form (::ffff:7f00:1) as parsed by URL()
  const hexMapped = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16);
    const lo = parseInt(hexMapped[2], 16);
    const a = (hi >> 8) & 0xff;
    const b = hi & 0xff;
    const c = (lo >> 8) & 0xff;
    const d = lo & 0xff;
    return isBlockedIpv4(`${a}.${b}.${c}.${d}`);
  }
  return false;
}

/** String-based hostname check (pre-DNS, best-effort) */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // Strip brackets from IPv6 literals
  const bare = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;

  if (BLOCKED_HOSTNAMES.has(bare)) return true;
  // IPv4 checks
  if (isBlockedIpv4(bare)) return true;
  // IPv6 literal checks
  if (isBlockedIpv6(bare)) return true;
  // .local / .internal TLDs
  if (/\.(local|internal)$/i.test(bare)) return true;
  return false;
}

function validateUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol !== "https:" &&
      process.env.NODE_ENV === "production"
    ) {
      return "url must use HTTPS in production";
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "url must use HTTP or HTTPS protocol";
    }
    if (isBlockedHost(parsed.hostname)) {
      return "url must not point to private or internal addresses";
    }
    return null;
  } catch {
    return "url must be a valid URL";
  }
}

/**
 * DNS resolution + IP class check.
 * Must be called at fetch-time (not at validation-time) to prevent
 * DNS rebinding and catch hostnames that resolve to private IPs.
 */
export async function assertUrlNotPrivate(url: string): Promise<void> {
  const parsed = new URL(url);
  const { address, family } = await lookup(parsed.hostname);

  if (family === 4 && isBlockedIpv4(address)) {
    throw new Error("URL resolves to a blocked private/internal address");
  }
  if (family === 6 && isBlockedIpv6(address)) {
    throw new Error("URL resolves to a blocked private/internal address");
  }
}

export function validateWebhookCreate(
  body: unknown,
): WebhookCreateResult | ValidationError {
  if (!body || typeof body !== "object") {
    return { error: "Request body is required" };
  }

  const { name, url, events } = body as Record<string, unknown>;

  // name validation
  if (typeof name !== "string" || name.trim().length === 0) {
    return { error: "name is required and must be a non-empty string" };
  }
  if (name.trim().length > 100) {
    return { error: "name must be at most 100 characters" };
  }

  // url validation
  if (typeof url !== "string" || url.trim().length === 0) {
    return { error: "url is required and must be a non-empty string" };
  }
  const urlError = validateUrl(url.trim());
  if (urlError) {
    return { error: urlError };
  }

  // events validation
  if (!Array.isArray(events) || events.length === 0) {
    return { error: "events must be a non-empty array" };
  }
  if (events.length > WEBHOOK_DEFAULTS.MAX_EVENTS) {
    return {
      error: `events must have at most ${WEBHOOK_DEFAULTS.MAX_EVENTS} items`,
    };
  }
  const validEvents = WEBHOOK_EVENTS as readonly string[];
  for (const event of events) {
    if (typeof event !== "string" || !validEvents.includes(event)) {
      return {
        error: `Invalid event type: ${String(event)}. Valid types: ${WEBHOOK_EVENTS.join(", ")}`,
      };
    }
  }

  return {
    name: name.trim(),
    url: url.trim(),
    events: events as string[],
  };
}

export function validateWebhookUpdate(
  body: unknown,
): WebhookUpdateResult | ValidationError {
  if (!body || typeof body !== "object") {
    return { error: "Request body is required" };
  }

  const { name, url, events, isActive } = body as Record<string, unknown>;
  const result: WebhookUpdateResult = {};
  let hasField = false;

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return { error: "name must be a non-empty string" };
    }
    if (name.trim().length > 100) {
      return { error: "name must be at most 100 characters" };
    }
    result.name = name.trim();
    hasField = true;
  }

  if (url !== undefined) {
    if (typeof url !== "string" || url.trim().length === 0) {
      return { error: "url must be a non-empty string" };
    }
    const urlError = validateUrl(url.trim());
    if (urlError) {
      return { error: urlError };
    }
    result.url = url.trim();
    hasField = true;
  }

  if (events !== undefined) {
    if (!Array.isArray(events) || events.length === 0) {
      return { error: "events must be a non-empty array" };
    }
    if (events.length > WEBHOOK_DEFAULTS.MAX_EVENTS) {
      return {
        error: `events must have at most ${WEBHOOK_DEFAULTS.MAX_EVENTS} items`,
      };
    }
    const validEvents = WEBHOOK_EVENTS as readonly string[];
    for (const event of events) {
      if (typeof event !== "string" || !validEvents.includes(event)) {
        return {
          error: `Invalid event type: ${String(event)}. Valid types: ${WEBHOOK_EVENTS.join(", ")}`,
        };
      }
    }
    result.events = events as string[];
    hasField = true;
  }

  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") {
      return { error: "isActive must be a boolean" };
    }
    result.isActive = isActive;
    hasField = true;
  }

  if (!hasField) {
    return { error: "At least one field must be provided for update" };
  }

  return result;
}
