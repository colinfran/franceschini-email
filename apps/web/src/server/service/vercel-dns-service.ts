import { TRPCError } from "@trpc/server";
import { getDomain } from "tldts";
import { z } from "zod";
import type { DomainDnsRecord } from "~/types/domain";

const recordsSchema = z.object({
  records: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      value: z.string(),
      mxPriority: z.number().optional(),
    }),
  ),
  pagination: z.object({ next: z.number().nullable() }).optional(),
});

export async function configureVercelDns({
  domainName,
  records,
  token,
  teamId,
}: {
  domainName: string;
  records: DomainDnsRecord[];
  token: string;
  teamId?: string;
}) {
  const zone = getDomain(domainName);
  if (!zone) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid domain name.",
    });
  }
  const encodedZone = encodeURIComponent(zone);

  async function request(version: string, init?: RequestInit, until?: number) {
    const url = new URL(
      `https://api.vercel.com/${version}/domains/${encodedZone}/records`,
    );
    if (teamId) url.searchParams.set("teamId", teamId);
    if (!init) url.searchParams.set("limit", "100");
    if (until !== undefined) url.searchParams.set("until", String(until));

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message:
          "Could not reach Vercel. Some records may already have been added; retry to continue safely.",
      });
    }
    if (!response.ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          `Vercel DNS request failed (HTTP ${response.status}). Check your token, team ID, and that ${zone} uses Vercel DNS. ` +
          "Some records may already have been added; retry to continue safely.",
      });
    }
    return response;
  }

  const existing: z.infer<typeof recordsSchema>["records"] = [];
  const seen = new Set<number>();
  let until: number | undefined;
  do {
    const response = await request("v5", undefined, until);
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "Vercel returned an invalid DNS records response.",
      });
    }
    const page = recordsSchema.safeParse(data);
    if (!page.success) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "Vercel returned an invalid DNS records response.",
      });
    }
    existing.push(...page.data.records);
    const next = page.data.pagination?.next;
    if (next == null) break;
    if (seen.has(next)) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "Vercel returned an invalid DNS pagination cursor.",
      });
    }
    seen.add(next);
    until = next;
  } while (true);

  const normalizeHost = (value: string) =>
    value.toLowerCase().replace(/\.$/, "");
  const pending: DomainDnsRecord[] = [];
  let skipped = 0;
  for (const record of records) {
    const atName = existing.filter(
      (item) => normalizeHost(item.name) === normalizeHost(record.name),
    );
    const sameType = atName.filter((item) => item.type === record.type);
    const isMatch = (item: (typeof existing)[number]) => {
      if (record.type === "TXT") return item.value === record.value;
      const value = /^\d+\s/.test(item.value)
        ? item.value
        : `${item.mxPriority} ${item.value}`;
      return (
        normalizeHost(value) ===
        normalizeHost(`${record.priority} ${record.value}`)
      );
    };
    if (record.recommended && sameType.length > 0) {
      skipped++;
      continue;
    }
    const conflicts =
      atName.some((item) => item.type === "CNAME") ||
      sameType
        .filter((item) => !isMatch(item))
        .some(
          (item) =>
            record.type === "MX" ||
            record.name.includes("._domainkey") ||
            item.value.trim().toLowerCase().startsWith("v=spf1"),
        );
    if (conflicts) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `An existing DNS record conflicts with ${record.type} ${record.name}. No records were added. Review it in Vercel first.`,
      });
    }
    if (sameType.some(isMatch)) {
      skipped++;
      continue;
    }
    pending.push(record);
  }

  let created = 0;
  for (const record of pending) {
    await request("v2", {
      method: "POST",
      body: JSON.stringify({
        name: record.name,
        type: record.type,
        value: record.value,
        ttl: 60,
        ...(record.type === "MX"
          ? { mxPriority: Number(record.priority) }
          : {}),
      }),
    });
    created++;
  }
  return { created, skipped, zone };
}
