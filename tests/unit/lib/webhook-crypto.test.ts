import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const TEST_KEY = "a".repeat(64); // valid 64-char hex

describe("webhook-crypto", () => {
  const originalEnv = process.env.WEBHOOK_ENCRYPTION_KEY;

  beforeEach(() => {
    vi.resetModules();
    process.env.WEBHOOK_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.WEBHOOK_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.WEBHOOK_ENCRYPTION_KEY;
    }
  });

  it("encryptSecret → decryptSecret roundtrip", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/webhook-crypto");
    const plain = "whsec_test_secret_123";
    const encrypted = encryptSecret(plain);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(plain);
  });

  it("produces different ciphertext for the same plaintext (random IV)", async () => {
    const { encryptSecret } = await import("@/lib/webhook-crypto");
    const plain = "whsec_same_secret";
    const a = encryptSecret(plain);
    const b = encryptSecret(plain);
    expect(a).not.toBe(b);
  });

  it("throws on invalid ciphertext", async () => {
    const { decryptSecret } = await import("@/lib/webhook-crypto");
    expect(() => decryptSecret("not-valid-base64!!!")).toThrow();
  });

  it("throws on too-short ciphertext", async () => {
    const { decryptSecret } = await import("@/lib/webhook-crypto");
    const short = Buffer.alloc(10).toString("base64");
    expect(() => decryptSecret(short)).toThrow("Invalid encrypted data: too short");
  });

  it("signPayload is deterministic", async () => {
    const { signPayload } = await import("@/lib/webhook-crypto");
    const sig1 = signPayload("secret", "payload");
    const sig2 = signPayload("secret", "payload");
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("signPayload returns different signatures for different secrets", async () => {
    const { signPayload } = await import("@/lib/webhook-crypto");
    const sig1 = signPayload("secret1", "payload");
    const sig2 = signPayload("secret2", "payload");
    expect(sig1).not.toBe(sig2);
  });

  it("generateWebhookSecret has correct format", async () => {
    const { generateWebhookSecret } = await import("@/lib/webhook-crypto");
    const secret = generateWebhookSecret();
    expect(secret).toMatch(/^whsec_[a-f0-9]{64}$/);
    expect(secret).toHaveLength(70); // "whsec_" (6) + 64 hex chars
  });

  it("throws when WEBHOOK_ENCRYPTION_KEY is missing", async () => {
    delete process.env.WEBHOOK_ENCRYPTION_KEY;
    const { encryptSecret } = await import("@/lib/webhook-crypto");
    expect(() => encryptSecret("test")).toThrow("WEBHOOK_ENCRYPTION_KEY");
  });

  it("throws when WEBHOOK_ENCRYPTION_KEY is wrong length", async () => {
    process.env.WEBHOOK_ENCRYPTION_KEY = "tooshort";
    const { encryptSecret } = await import("@/lib/webhook-crypto");
    expect(() => encryptSecret("test")).toThrow("WEBHOOK_ENCRYPTION_KEY");
  });

  it("throws when WEBHOOK_ENCRYPTION_KEY has non-hex characters", async () => {
    process.env.WEBHOOK_ENCRYPTION_KEY = "z".repeat(64);
    const { encryptSecret } = await import("@/lib/webhook-crypto");
    expect(() => encryptSecret("test")).toThrow("WEBHOOK_ENCRYPTION_KEY");
  });
});
