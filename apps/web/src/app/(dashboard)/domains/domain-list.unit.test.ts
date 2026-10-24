import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type Domain, DomainStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DomainsList from "./domain-list";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("~/trpc/react", () => ({
  api: {
    domain: {
      domains: { useQuery: mocks.query },
      updateDomain: { useMutation: mocks.mutation },
    },
    useUtils: () => ({
      domain: { domains: { invalidate: mocks.invalidate } },
    }),
  },
}));

vi.mock("./add-domain", () => ({
  default: () => createElement("button", null, "Add domain"),
}));

const domain: Domain = {
  id: 1,
  name: "mail.example.com",
  teamId: 1,
  status: DomainStatus.SUCCESS,
  region: "us-east-1",
  clickTracking: false,
  openTracking: true,
  publicKey: "",
  dkimSelector: "usesend",
  dkimStatus: "SUCCESS",
  spfDetails: "PENDING",
  dmarcAdded: true,
  errorMessage: null,
  subdomain: null,
  sesTenantId: null,
  isVerifying: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("Domains list", () => {
  beforeEach(() => {
    mocks.query.mockReturnValue({
      data: [domain],
      isLoading: false,
      isError: false,
    });
    mocks.mutation.mockReturnValue({ isPending: false, mutate: vi.fn() });
  });

  it("renders a searchable table with verification and accessible tracking controls", () => {
    const html = renderToStaticMarkup(createElement(DomainsList));
    expect(html).toContain('aria-label="Search domains"');
    expect(html).toContain("1 of 1 verified");
    expect(html).toContain('href="/domains/1"');
    expect(html).toContain("mail.example.com");
    expect(html).toContain("DKIM");
    expect(html).toContain("SPF");
    expect(html).toContain("DMARC");
    expect(html).toContain("not verified");
    expect(html).toContain('aria-label="Open tracking for mail.example.com"');
    expect(html).toContain('aria-label="Click tracking for mail.example.com"');
    expect(html.match(/role="switch"/g)).toHaveLength(2);
    expect(html).not.toContain("Needs attention");
  });

  it("disables both tracking controls while an update is pending", () => {
    mocks.mutation.mockReturnValue({ isPending: true, mutate: vi.fn() });
    const html = renderToStaticMarkup(createElement(DomainsList));
    const switches = html.match(/<button[^>]*role="switch"[^>]*>/g) ?? [];
    expect(switches).toHaveLength(2);
    for (const control of switches) {
      expect(control).toContain(' disabled=""');
    }
  });

  it("shows loading instead of an empty state while fetching", () => {
    mocks.query.mockReturnValue({ isLoading: true, isError: false });
    const html = renderToStaticMarkup(createElement(DomainsList));
    expect(html).toContain('aria-label="Loading domains"');
    expect(html).not.toContain("No domains yet");
  });

  it("distinguishes a failed query from an empty account", () => {
    mocks.query.mockReturnValue({
      isError: true,
      error: { message: "Connection unavailable" },
    });
    const html = renderToStaticMarkup(createElement(DomainsList));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Connection unavailable");
    expect(html).toContain("Try again");
    expect(html).not.toContain("No domains yet");
  });

  it("offers an add action when there are no domains", () => {
    mocks.query.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    const html = renderToStaticMarkup(createElement(DomainsList));
    expect(html).toContain("No domains yet");
    expect(html).toContain("Add domain");
  });
});
