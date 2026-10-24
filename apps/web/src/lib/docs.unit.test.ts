import { describe, expect, it } from "vitest";
import { docsHref, isDocSlug } from "./docs";
import { getDocOperation } from "./docs-api";

describe("documentation URLs", () => {
  it.each([
    ["/get-started/nodejs#using-sdk", "/docs/get-started/nodejs#using-sdk"],
    ["/api-reference/introduction", "/docs/api-reference/introduction"],
    ["/guides/webhooks", "/docs/guides/webhooks"],
    ["/docs/guides/webhooks", "/docs/guides/webhooks"],
    [
      "https://docs.usesend.com/guides/webhooks?q=1#events",
      "/docs/guides/webhooks?q=1#events",
    ],
    ["https://docs.usesend.com/", "/docs"],
    ["https://app.usesend.com/domains", "/domains"],
    ["/images/aws/key-1.png", "/docs/assets/images/aws/key-1.png"],
    ["/dashboard", "/dashboard"],
    ["#signature-verification", "#signature-verification"],
    ["https://example.com", "https://example.com"],
  ])("maps %s to this installation", (source, expected) => {
    expect(docsHref(source)).toBe(expected);
  });

  it.each([
    [".."],
    ["..", "env"],
    ["guides/webhooks"],
    ["%2e%2e"],
    ["a\\b"],
    [],
  ])("rejects invalid path segments %j", (...parts) => {
    expect(isDocSlug(parts)).toBe(false);
  });

  it("accepts nested page slugs", () => {
    expect(isDocSlug(["api-reference", "emails", "send-email"])).toBe(true);
  });
});

describe("API reference operations", () => {
  const document = {
    paths: {
      "/v1/emails": {
        post: {
          summary: "Send email",
          requestBody: {
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: { "200": { description: "Email queued" } },
        },
      },
    },
  };
  it("selects the operation and preserves request and response shapes", () => {
    expect(getDocOperation(document, "post /v1/emails")).toMatchObject({
      method: "POST",
      path: "/v1/emails",
      summary: "Send email",
      requestBody: document.paths["/v1/emails"].post.requestBody,
      responses: document.paths["/v1/emails"].post.responses,
    });
  });
  it("fails explicitly for missing or invalid operations", () => {
    expect(() => getDocOperation(document, "get /v1/missing")).toThrow(
      "API operation not found",
    );
    expect(() => getDocOperation(document, "../env")).toThrow(
      "Invalid documentation operation",
    );
    expect(() => getDocOperation({}, "get /v1/emails")).toThrow();
  });
});
