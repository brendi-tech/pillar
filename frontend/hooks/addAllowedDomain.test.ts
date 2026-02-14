import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeAddAllowedDomain,
  type AddAllowedDomainDeps,
} from "./addAllowedDomain";

function makeDeps(
  overrides: Partial<AddAllowedDomainDeps> = {}
): AddAllowedDomainDeps {
  return {
    currentProduct: {
      id: "prod-123",
      config: {
        embed: {
          security: {
            allowedDomains: ["existing.com"],
            restrictToAllowedDomains: true,
          },
        },
      },
    },
    adminPatch: vi.fn().mockResolvedValue(undefined),
    invalidateQueries: vi.fn(),
    nav: vi.fn(),
    ...overrides,
  };
}

describe("executeAddAllowedDomain", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when no product is selected", async () => {
    const deps = makeDeps({ currentProduct: null });
    const result = await executeAddAllowedDomain({ domain: "example.com" }, deps);

    expect(result).toEqual({ success: false, error: "No product selected" });
    expect(deps.adminPatch).not.toHaveBeenCalled();
  });

  it("returns error when domain is empty", async () => {
    const deps = makeDeps();
    const result = await executeAddAllowedDomain({ domain: "" }, deps);

    expect(result).toEqual({ success: false, error: "Domain is required" });
    expect(deps.adminPatch).not.toHaveBeenCalled();
  });

  it("returns error when domain is undefined", async () => {
    const deps = makeDeps();
    const result = await executeAddAllowedDomain({}, deps);

    expect(result).toEqual({ success: false, error: "Domain is required" });
    expect(deps.adminPatch).not.toHaveBeenCalled();
  });

  it("returns error when domain fails validation", async () => {
    const deps = makeDeps();
    const result = await executeAddAllowedDomain(
      { domain: "http://bad.com" },
      deps
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid domain/i);
    expect(deps.adminPatch).not.toHaveBeenCalled();
  });

  it("returns error when domain already exists in the list", async () => {
    const deps = makeDeps();
    const result = await executeAddAllowedDomain(
      { domain: "existing.com" },
      deps
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already/i);
    expect(deps.adminPatch).not.toHaveBeenCalled();
  });

  it("trims and lowercases the domain before checking", async () => {
    const deps = makeDeps();
    const result = await executeAddAllowedDomain(
      { domain: "  EXISTING.COM  " },
      deps
    );

    // Should match the existing domain after normalization
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already/i);
  });

  it("calls adminPatch with the correct payload on valid domain", async () => {
    const deps = makeDeps();
    await executeAddAllowedDomain({ domain: "newdomain.com" }, deps);

    expect(deps.adminPatch).toHaveBeenCalledTimes(1);
    const [endpoint, body] = (deps.adminPatch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(endpoint).toBe("/configs/prod-123/");
    expect(body.config.embed.security.allowedDomains).toEqual([
      "existing.com",
      "newdomain.com",
    ]);
  });

  it("invalidates config queries after successful patch", async () => {
    const deps = makeDeps();
    await executeAddAllowedDomain({ domain: "newdomain.com" }, deps);

    expect(deps.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("navigates to /configure after success", async () => {
    const deps = makeDeps();
    await executeAddAllowedDomain({ domain: "newdomain.com" }, deps);

    expect(deps.nav).toHaveBeenCalledWith("/configure");
  });

  it("returns success message on valid domain", async () => {
    const deps = makeDeps();
    const result = await executeAddAllowedDomain(
      { domain: "newdomain.com" },
      deps
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain("newdomain.com");
  });

  it("returns error when adminPatch throws", async () => {
    const deps = makeDeps({
      adminPatch: vi.fn().mockRejectedValue(new Error("Network error")),
    });
    const result = await executeAddAllowedDomain(
      { domain: "newdomain.com" },
      deps
    );

    expect(result).toEqual({
      success: false,
      error: "Failed to add allowed domain",
    });
    expect(deps.invalidateQueries).not.toHaveBeenCalled();
    expect(deps.nav).not.toHaveBeenCalled();
  });

  it("handles product with no existing embed config gracefully", async () => {
    const deps = makeDeps({
      currentProduct: {
        id: "prod-456",
        config: {},
      },
    });
    const result = await executeAddAllowedDomain(
      { domain: "localhost:3000" },
      deps
    );

    expect(result.success).toBe(true);
    const [, body] = (deps.adminPatch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(body.config.embed.security.allowedDomains).toEqual([
      "localhost:3000",
    ]);
  });
});
