import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateWebhookCreate, validateWebhookUpdate, assertUrlNotPrivate } from "@/lib/webhook-validation";

vi.mock("dns/promises", () => {
  const lookup = vi.fn();
  return { default: { lookup }, lookup };
});

describe("validateWebhookCreate", () => {
  const validBody = {
    name: "My Webhook",
    url: "https://example.com/hook",
    events: ["anomaly.created"],
  };

  it("accepts valid create body", () => {
    const result = validateWebhookCreate(validBody);
    expect(result).toEqual({
      name: "My Webhook",
      url: "https://example.com/hook",
      events: ["anomaly.created"],
    });
  });

  it("trims name and url", () => {
    const result = validateWebhookCreate({
      ...validBody,
      name: "  Trimmed  ",
      url: "  https://example.com/hook  ",
    });
    expect(result).toEqual(
      expect.objectContaining({ name: "Trimmed", url: "https://example.com/hook" }),
    );
  });

  it("rejects null body", () => {
    const result = validateWebhookCreate(null);
    expect(result).toEqual({ error: "Request body is required" });
  });

  it("rejects missing name", () => {
    const result = validateWebhookCreate({ url: "https://x.com", events: ["anomaly.created"] });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("name");
  });

  it("rejects empty name", () => {
    const result = validateWebhookCreate({ ...validBody, name: "   " });
    expect(result).toHaveProperty("error");
  });

  it("rejects name over 100 chars", () => {
    const result = validateWebhookCreate({ ...validBody, name: "x".repeat(101) });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("100");
  });

  it("rejects invalid URL", () => {
    const result = validateWebhookCreate({ ...validBody, url: "not-a-url" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("url");
  });

  it("rejects non-http(s) protocol", () => {
    const result = validateWebhookCreate({ ...validBody, url: "ftp://example.com" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("protocol");
  });

  it("rejects empty events array", () => {
    const result = validateWebhookCreate({ ...validBody, events: [] });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("events");
  });

  it("rejects non-array events", () => {
    const result = validateWebhookCreate({ ...validBody, events: "anomaly.created" });
    expect(result).toHaveProperty("error");
  });

  it("rejects invalid event type", () => {
    const result = validateWebhookCreate({ ...validBody, events: ["invalid.event"] });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Invalid event type");
  });

  it("rejects events over MAX_EVENTS limit", () => {
    const events = Array(21).fill("anomaly.created");
    const result = validateWebhookCreate({ ...validBody, events });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("20");
  });

  it("accepts multiple valid event types", () => {
    const result = validateWebhookCreate({
      ...validBody,
      events: ["anomaly.created", "validator.jailed", "endpoint.down"],
    });
    expect(result).not.toHaveProperty("error");
    expect((result as { events: string[] }).events).toHaveLength(3);
  });

  describe("SSRF protection — string-based", () => {
    it.each([
      ["http://localhost/hook", "localhost"],
      ["http://127.0.0.1/hook", "loopback IPv4"],
      ["http://127.0.0.2/hook", "loopback range"],
      ["http://127.255.0.1/hook", "loopback range high"],
      ["http://0.0.0.0/hook", "unspecified IPv4"],
      ["http://[::1]/hook", "loopback IPv6"],
      ["http://[fe80::1]/hook", "link-local IPv6"],
      ["http://[fc00::1]/hook", "ULA IPv6 (fc)"],
      ["http://[fd12::1]/hook", "ULA IPv6 (fd)"],
      ["http://[::ffff:127.0.0.1]/hook", "IPv4-mapped IPv6 loopback"],
      ["http://[::ffff:10.0.0.1]/hook", "IPv4-mapped IPv6 private"],
      ["http://10.0.0.1/hook", "10.x private"],
      ["http://172.16.0.1/hook", "172.16.x private"],
      ["http://192.168.1.1/hook", "192.168.x private"],
      ["http://169.254.169.254/hook", "link-local / cloud metadata"],
      ["http://metadata.google.internal/hook", "GCP metadata"],
      ["http://service.local/hook", ".local TLD"],
      ["http://app.internal/hook", ".internal TLD"],
    ])("rejects %s (%s)", (url) => {
      const result = validateWebhookCreate({ ...validBody, url });
      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error).toContain("private or internal");
    });
  });
});

describe("validateWebhookUpdate", () => {
  it("accepts partial update with name only", () => {
    const result = validateWebhookUpdate({ name: "Updated" });
    expect(result).toEqual({ name: "Updated" });
  });

  it("accepts partial update with isActive only", () => {
    const result = validateWebhookUpdate({ isActive: false });
    expect(result).toEqual({ isActive: false });
  });

  it("accepts full update", () => {
    const result = validateWebhookUpdate({
      name: "Updated",
      url: "https://new.example.com/hook",
      events: ["anomaly.resolved"],
      isActive: true,
    });
    expect(result).toEqual({
      name: "Updated",
      url: "https://new.example.com/hook",
      events: ["anomaly.resolved"],
      isActive: true,
    });
  });

  it("rejects empty body", () => {
    const result = validateWebhookUpdate({});
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("At least one field");
  });

  it("rejects null body", () => {
    const result = validateWebhookUpdate(null);
    expect(result).toEqual({ error: "Request body is required" });
  });

  it("rejects invalid isActive type", () => {
    const result = validateWebhookUpdate({ isActive: "yes" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("isActive");
  });

  it("rejects invalid name in update", () => {
    const result = validateWebhookUpdate({ name: "" });
    expect(result).toHaveProperty("error");
  });

  it("validates url in update", () => {
    const result = validateWebhookUpdate({ url: "not-valid" });
    expect(result).toHaveProperty("error");
  });

  it("validates events in update", () => {
    const result = validateWebhookUpdate({ events: ["fake.event"] });
    expect(result).toHaveProperty("error");
  });
});

describe("assertUrlNotPrivate — DNS resolution check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes for public IPv4", async () => {
    const { lookup } = await import("dns/promises");
    vi.mocked(lookup).mockResolvedValue({ address: "93.184.216.34", family: 4 } as never);
    await expect(assertUrlNotPrivate("https://example.com/hook")).resolves.toBeUndefined();
  });

  it("rejects when DNS resolves to loopback IPv4", async () => {
    const { lookup } = await import("dns/promises");
    vi.mocked(lookup).mockResolvedValue({ address: "127.0.0.1", family: 4 } as never);
    await expect(assertUrlNotPrivate("https://evil.com/hook")).rejects.toThrow("blocked");
  });

  it("rejects when DNS resolves to private IPv4 (10.x)", async () => {
    const { lookup } = await import("dns/promises");
    vi.mocked(lookup).mockResolvedValue({ address: "10.0.0.5", family: 4 } as never);
    await expect(assertUrlNotPrivate("https://evil.com/hook")).rejects.toThrow("blocked");
  });

  it("rejects when DNS resolves to private IPv4 (192.168.x)", async () => {
    const { lookup } = await import("dns/promises");
    vi.mocked(lookup).mockResolvedValue({ address: "192.168.1.100", family: 4 } as never);
    await expect(assertUrlNotPrivate("https://evil.com/hook")).rejects.toThrow("blocked");
  });

  it("rejects when DNS resolves to link-local IPv4", async () => {
    const { lookup } = await import("dns/promises");
    vi.mocked(lookup).mockResolvedValue({ address: "169.254.169.254", family: 4 } as never);
    await expect(assertUrlNotPrivate("https://evil.com/hook")).rejects.toThrow("blocked");
  });

  it("rejects when DNS resolves to IPv6 loopback", async () => {
    const { lookup } = await import("dns/promises");
    vi.mocked(lookup).mockResolvedValue({ address: "::1", family: 6 } as never);
    await expect(assertUrlNotPrivate("https://evil.com/hook")).rejects.toThrow("blocked");
  });

  it("rejects when DNS resolves to IPv6 link-local", async () => {
    const { lookup } = await import("dns/promises");
    vi.mocked(lookup).mockResolvedValue({ address: "fe80::1", family: 6 } as never);
    await expect(assertUrlNotPrivate("https://evil.com/hook")).rejects.toThrow("blocked");
  });

  it("rejects when DNS resolves to IPv6 ULA", async () => {
    const { lookup } = await import("dns/promises");
    vi.mocked(lookup).mockResolvedValue({ address: "fd12::1", family: 6 } as never);
    await expect(assertUrlNotPrivate("https://evil.com/hook")).rejects.toThrow("blocked");
  });

  it("rejects when DNS resolves to IPv4-mapped IPv6 private", async () => {
    const { lookup } = await import("dns/promises");
    vi.mocked(lookup).mockResolvedValue({ address: "::ffff:10.0.0.1", family: 6 } as never);
    await expect(assertUrlNotPrivate("https://evil.com/hook")).rejects.toThrow("blocked");
  });

  it("passes for public IPv6", async () => {
    const { lookup } = await import("dns/promises");
    vi.mocked(lookup).mockResolvedValue({ address: "2606:4700::6810:84e5", family: 6 } as never);
    await expect(assertUrlNotPrivate("https://example.com/hook")).resolves.toBeUndefined();
  });
});
