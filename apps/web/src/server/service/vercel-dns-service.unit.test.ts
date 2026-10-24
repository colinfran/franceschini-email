import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainStatus } from "@prisma/client";
import { configureVercelDns } from "./vercel-dns-service";
import type { DomainDnsRecord } from "~/types/domain";

const fetchMock = vi.fn<typeof fetch>();
const records: DomainDnsRecord[] = [
  {
    type: "MX",
    name: "mail.news",
    value: "feedback-smtp.us-east-1.amazonses.com",
    priority: "10",
    ttl: "Auto",
    status: DomainStatus.NOT_STARTED,
  },
  {
    type: "TXT",
    name: "usesend._domainkey.news",
    value: "p=public-key",
    ttl: "Auto",
    status: DomainStatus.NOT_STARTED,
  },
  {
    type: "TXT",
    name: "mail.news",
    value: "v=spf1 include:amazonses.com ~all",
    ttl: "Auto",
    status: DomainStatus.NOT_STARTED,
  },
  {
    type: "TXT",
    name: "_dmarc",
    value: "v=DMARC1; p=none;",
    ttl: "Auto",
    status: DomainStatus.NOT_STARTED,
    recommended: true,
  },
];
const options = {
  domainName: "news.example.co.uk",
  records,
  token: "secret-token",
  teamId: "team_123",
};
const page = (items: unknown[], next: number | null = null) =>
  Response.json({ records: items, pagination: { next } });

describe("configureVercelDns", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(Response.json({ uid: "created" }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("creates the exact records in the parent zone with team scope and MX priority", async () => {
    fetchMock.mockResolvedValueOnce(page([]));
    expect(await configureVercelDns(options)).toEqual({
      created: 4,
      skipped: 0,
      zone: "example.co.uk",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.vercel.com/v5/domains/example.co.uk/records?teamId=team_123&limit=100",
    );
    expect(init).toMatchObject({
      headers: { Authorization: "Bearer secret-token" },
      cache: "no-store",
      redirect: "error",
    });
    expect(
      fetchMock.mock.calls
        .slice(1)
        .map(([, request]) => JSON.parse(String(request?.body))),
    ).toEqual(
      records.map((record) => ({
        name: record.name,
        type: record.type,
        value: record.value,
        ttl: 60,
        ...(record.type === "MX" ? { mxPriority: 10 } : {}),
      })),
    );
  });

  it("skips existing records, including MX values returned with an embedded priority", async () => {
    fetchMock.mockResolvedValueOnce(
      page(
        records.map((record) => ({
          name: record.name,
          type: record.type,
          value:
            record.type === "MX"
              ? `10 ${record.value.toUpperCase()}.`
              : record.value,
        })),
      ),
    );
    expect(await configureVercelDns(options)).toMatchObject({
      created: 0,
      skipped: 4,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("supports separately returned MX priority and omits team scope for personal domains", async () => {
    fetchMock.mockResolvedValueOnce(
      page([
        {
          name: "mail.news",
          type: "MX",
          value: records[0]!.value,
          mxPriority: 10,
        },
      ]),
    );
    expect(
      await configureVercelDns({ ...options, teamId: undefined }),
    ).toMatchObject({ created: 3, skipped: 1 });
    expect(String(fetchMock.mock.calls[0]![0])).not.toContain("teamId");
  });

  it("preserves an existing DMARC policy and unrelated TXT records", async () => {
    fetchMock.mockResolvedValueOnce(
      page([
        { name: "_dmarc", type: "TXT", value: "v=DMARC1; p=reject;" },
        { name: "mail.news", type: "TXT", value: "some-other-verification" },
      ]),
    );
    expect(await configureVercelDns(options)).toMatchObject({
      created: 3,
      skipped: 1,
    });
  });

  it.each([
    {
      name: "mail.news",
      type: "TXT",
      value: "v=spf1 include:other.example ~all",
    },
    { name: "usesend._domainkey.news", type: "TXT", value: "p=another-key" },
    { name: "mail.news", type: "MX", value: "10 other.example" },
    { name: "mail.news", type: "CNAME", value: "other.example" },
  ])(
    "refuses conflicts before writing any records: $type $name",
    async (existing) => {
      fetchMock.mockResolvedValueOnce(page([existing]));
      await expect(configureVercelDns(options)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("checks every page before creating records", async () => {
    fetchMock.mockResolvedValueOnce(page([], 123));
    fetchMock.mockResolvedValueOnce(
      page([{ name: "mail.news", type: "CNAME", value: "other.example" }]),
    );
    await expect(configureVercelDns(options)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(String(fetchMock.mock.calls[1]![0])).toContain("until=123");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a repeated pagination cursor", async () => {
    fetchMock.mockResolvedValue(page([], 123));
    await expect(configureVercelDns(options)).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 404, 429, 500])(
    "reports HTTP %s without returning provider payloads or credentials",
    async (status) => {
      fetchMock.mockResolvedValueOnce(
        Response.json({ message: options.token }, { status }),
      );
      await expect(configureVercelDns(options)).rejects.toThrow(
        `HTTP ${status}`,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("reports a partial failure and allows a safe retry", async () => {
    fetchMock.mockResolvedValueOnce(page([]));
    fetchMock.mockResolvedValueOnce(Response.json({ uid: "first" }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 }));
    await expect(configureVercelDns(options)).rejects.toThrow(
      "Some records may already have been added",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    fetchMock.mockResolvedValueOnce(
      page([
        {
          name: records[0]!.name,
          type: "MX",
          value: `10 ${records[0]!.value}`,
        },
      ]),
    );
    expect(await configureVercelDns(options)).toMatchObject({
      created: 3,
      skipped: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it("rejects conflicting SPF records even when the desired SPF also exists", async () => {
    fetchMock.mockResolvedValueOnce(
      page([
        { name: "mail.news", type: "TXT", value: records[2]!.value },
        {
          name: "mail.news",
          type: "TXT",
          value: "v=spf1 include:other.example ~all",
        },
      ]),
    );
    await expect(configureVercelDns(options)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recognizes embedded MX priority even if Vercel also includes mxPriority", async () => {
    fetchMock.mockResolvedValueOnce(
      page([
        {
          name: "mail.news",
          type: "MX",
          value: `10 ${records[0]!.value}`,
          mxPriority: 10,
        },
      ]),
    );
    expect(await configureVercelDns(options)).toMatchObject({
      created: 3,
      skipped: 1,
    });
  });

  it("reports network errors without exposing the underlying error", async () => {
    fetchMock.mockRejectedValueOnce(new Error(options.token));
    await expect(configureVercelDns(options)).rejects.toThrow(
      "Could not reach Vercel",
    );
  });

  it.each([{}, { records: [{ name: "mail" }] }])(
    "rejects malformed record responses",
    async (data) => {
      fetchMock.mockResolvedValueOnce(Response.json(data));
      await expect(configureVercelDns(options)).rejects.toMatchObject({
        code: "BAD_GATEWAY",
      });
    },
  );

  it("rejects invalid JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("invalid"));
    await expect(configureVercelDns(options)).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
  });

  it("rejects an invalid domain without contacting Vercel", async () => {
    await expect(
      configureVercelDns({ ...options, domainName: "localhost" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
