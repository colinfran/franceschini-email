import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/mailer", () => ({
  sendMail: vi.fn(),
}));
vi.mock("~/server/queue/postgres-queue", () => ({
  Queue: class {},
  Worker: class {
    on = vi.fn();
  },
}));
vi.mock("~/server/public-api/auth", () => ({
  getTeamFromToken: vi.fn(async () => ({
    id: 1,
    apiRateLimit: 100,
    apiKeyId: 1,
    apiKey: { domainId: null },
  })),
}));
vi.mock("~/server/postgres-state", () => ({
  getStateTtl: vi.fn(async () => 1),
  incrementState: vi.fn(async () => 1),
}));

import { app } from "./index";

describe("transactional-only public API", () => {
  it("keeps email, domain, and analytics endpoints but exposes no contacts or campaigns", async () => {
    const response = await app.request("/api/v1/doc");
    expect(response.status).toBe(200);
    const document = await response.json();
    const paths = Object.keys(document.paths);
    expect(paths).toContain("/v1/emails");
    expect(paths).toContain("/v1/domains");
    expect(paths.some((path) => path.includes("analytics"))).toBe(true);
    expect(paths.some((path) => /contact|campaign/i.test(path))).toBe(false);
    for (const path of ["/v1/emails", "/v1/emails/batch"]) {
      const schema =
        document.paths[path].post.requestBody.content["application/json"]
          .schema;
      const item = schema.items ?? schema;
      expect(item.properties).not.toHaveProperty("templateId");
      expect(item.properties).not.toHaveProperty("variables");
      expect(item.required).toContain("subject");
      expect(item.additionalProperties).toBe(false);
    }
  });

  it.each([
    { templateId: "retired-template" },
    { variables: { name: "Recipient" } },
    { subject: undefined },
    { html: undefined },
  ])(
    "rejects unsupported send payload %j for single and batch sends",
    async (overrides) => {
      const payload = {
        to: "recipient@example.com",
        from: "sender@example.com",
        subject: "Hello",
        html: "<p>Hello</p>",
        ...overrides,
      };
      for (const [path, body] of [
        ["/api/v1/emails", payload],
        ["/api/v1/emails/batch", [payload]],
      ] as const) {
        const response = await app.request(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        expect(response.status).toBe(400);
        expect(await response.json()).toHaveProperty("success", false);
      }
    },
  );

  it.each([
    "/api/v1/contactBooks",
    "/api/v1/contactBooks/book-id/contacts",
    "/api/v1/campaigns",
    "/api/v1/campaigns/campaign-id/schedule",
  ])("does not route GET or POST %s", async (path) => {
    expect((await app.request(path)).status).toBe(404);
    expect((await app.request(path, { method: "POST" })).status).toBe(404);
  });
});
