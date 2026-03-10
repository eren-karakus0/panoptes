import { describe, it, expect, vi } from "vitest";

vi.mock("swr", () => ({
  default: vi.fn(
    (url: string | null, _config?: Record<string, unknown>) => ({
      data: undefined,
      error: undefined,
      isLoading: true,
      _url: url,
    }),
  ),
}));

vi.mock("@/hooks/use-api", () => ({
  defaultSwrConfig: { fetcher: vi.fn() },
}));

import useSWR from "swr";
import { useValidators, useValidatorDetail } from "@/hooks/use-validators";

describe("useValidators", () => {
  it("calls SWR with /api/validators when no params", () => {
    useValidators();
    expect(useSWR).toHaveBeenCalledWith(
      "/api/validators",
      expect.any(Object),
    );
  });

  it("builds query string from filter params", () => {
    useValidators({
      status: "BOND_STATUS_BONDED",
      jailed: true,
      sort: "commission",
      order: "asc",
      limit: 10,
      offset: 20,
    });

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toContain("status=BOND_STATUS_BONDED");
    expect(url).toContain("jailed=true");
    expect(url).toContain("sort=commission");
    expect(url).toContain("order=asc");
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=20");
  });
});

describe("useValidatorDetail", () => {
  it("calls SWR with validator ID URL", () => {
    useValidatorDetail("raivaloper1abc");

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toBe("/api/validators/raivaloper1abc");
  });

  it("passes null URL when ID is empty", () => {
    useValidatorDetail("");

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    expect(call?.[0]).toBeNull();
  });
});
