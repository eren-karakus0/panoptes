import { createHmac, timingSafeEqual } from "crypto";
import { STREAM_DEFAULTS } from "@/lib/constants";

function getSecret(): string {
  const secret = process.env.STREAM_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "STREAM_TOKEN_SECRET must be at least 32 characters. Generate with: openssl rand -hex 32",
    );
  }
  return secret;
}

function toBase64Url(data: string): string {
  return Buffer.from(data, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(b64: string): string {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function createStreamToken(
  workspaceId: string,
  ttlSeconds: number = STREAM_DEFAULTS.TOKEN_TTL_SECONDS,
): string {
  const secret = getSecret();
  const payload = JSON.stringify({
    wid: workspaceId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
  const encodedPayload = toBase64Url(payload);
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyStreamToken(
  token: string,
): { valid: true; workspaceId: string } | { valid: false; error: string } {
  const secret = getSecret();

  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) {
    return { valid: false, error: "Malformed token" };
  }

  const encodedPayload = token.slice(0, dotIndex);
  const providedSig = token.slice(dotIndex + 1);

  const expectedSig = sign(encodedPayload, secret);

  const sigA = Buffer.from(providedSig, "utf8");
  const sigB = Buffer.from(expectedSig, "utf8");
  if (sigA.length !== sigB.length || !timingSafeEqual(sigA, sigB)) {
    return { valid: false, error: "Invalid signature" };
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as {
      wid: string;
      exp: number;
    };

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: "Token expired" };
    }

    return { valid: true, workspaceId: payload.wid };
  } catch {
    return { valid: false, error: "Invalid payload" };
  }
}
