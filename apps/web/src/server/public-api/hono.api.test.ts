import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnsendApiError } from "~/server/public-api/api-error";

const { mockGetTeamFromToken, mockState } = vi.hoisted(() => ({
  mockGetTeamFromToken: vi.fn(),
  mockState: {
    incrementState: vi.fn(),
    getStateTtl: vi.fn(),
  },
}));

vi.mock("~/server/public-api/auth", () => ({
  getTeamFromToken: mockGetTeamFromToken,
}));

vi.mock("~/server/postgres-state", () => ({
  incrementState: mockState.incrementState,
  getStateTtl: mockState.getStateTtl,
}));

vi.mock("~/utils/common", () => ({
  isSelfHosted: () => false,
}));

import { getApp } from "~/server/public-api/hono";

describe("public API Hono middleware", () => {
  beforeEach(() => {
    mockGetTeamFromToken.mockReset();
    mockState.incrementState.mockReset();
    mockState.getStateTtl.mockReset();
  });

  it("applies auth and rate limit headers", async () => {
    mockGetTeamFromToken.mockResolvedValue({
      id: 1,
      apiRateLimit: 2,
      apiKeyId: 11,
      apiKey: { domainId: null },
    });
    mockState.incrementState.mockResolvedValue(1);
    mockState.getStateTtl.mockResolvedValue(1);

    const app = getApp();
    app.get("/v1/ping", (c) => c.json({ ok: true }));

    const response = await app.request("http://localhost/api/v1/ping", {
      headers: {
        Authorization: "Bearer test-key",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("1");
  });

  it("returns 429 when limit is exceeded", async () => {
    mockGetTeamFromToken.mockResolvedValue({
      id: 1,
      apiRateLimit: 2,
      apiKeyId: 11,
      apiKey: { domainId: null },
    });
    mockState.incrementState.mockResolvedValue(3);
    mockState.getStateTtl.mockResolvedValue(1);

    const app = getApp();
    app.get("/v1/ping", (c) => c.json({ ok: true }));

    const response = await app.request("http://localhost/api/v1/ping", {
      headers: {
        Authorization: "Bearer test-key",
      },
    });

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toMatchObject({
      error: {
        code: "RATE_LIMITED",
      },
    });
  });

  it("returns auth error from middleware", async () => {
    mockGetTeamFromToken.mockRejectedValue(
      new UnsendApiError({
        code: "UNAUTHORIZED",
        message: "No Authorization header provided",
      }),
    );

    const app = getApp();
    app.get("/v1/ping", (c) => c.json({ ok: true }));

    const response = await app.request("http://localhost/api/v1/ping");

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({
      error: {
        code: "UNAUTHORIZED",
      },
    });
  });
});
