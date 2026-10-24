"use client";

import { Domain, DomainStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, Globe, Search } from "lucide-react";
import Link from "next/link";
import React from "react";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Skeleton } from "@usesend/ui/src/skeleton";
import { Switch } from "@usesend/ui/src/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@usesend/ui/src/table";
import { toast } from "@usesend/ui/src/toaster";
import { cn } from "@usesend/ui";
import { api } from "~/trpc/react";
import AddDomain from "./add-domain";
import { DomainStatusBadge } from "./domain-badge";

export default function DomainsList() {
  const [search, setSearch] = React.useState("");
  const domainsQuery = api.domain.domains.useQuery();
  const domains = domainsQuery.data ?? [];

  if (domainsQuery.isError) {
    return (
      <div role="alert" className="space-y-3 rounded-lg border p-6">
        <p className="text-sm text-destructive">
          Unable to load domains: {domainsQuery.error.message}
        </p>
        <Button variant="outline" onClick={() => void domainsQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (domainsQuery.isLoading) {
    return <DomainsLoading />;
  }

  if (!domains.length) {
    return <DomainsEmpty />;
  }

  const verified = domains.filter(
    (d) => d.status === DomainStatus.SUCCESS,
  ).length;
  const filteredDomains = domains.filter((domain) =>
    domain.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search domains"
            placeholder="Search domains..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {verified} of {domains.length} verified
        </p>
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table className="min-w-[760px]">
          <TableHeader className="in-[.app]:bg-transparent">
            <TableRow className="hover:bg-transparent">
              <TableHead>Domain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>DNS records</TableHead>
              <TableHead>Open tracking</TableHead>
              <TableHead>Click tracking</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Open domain</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDomains.length ? (
              filteredDomains.map((domain) => (
                <DomainRow key={domain.id} domain={domain} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  No domains match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        {filteredDomains.length} domain{filteredDomains.length === 1 ? "" : "s"}
        {search.trim() ? ` matching "${search.trim()}"` : ""}
      </p>
    </div>
  );
}

function DnsCheck({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      title={`${label} ${ok ? "verified" : "not verified"}`}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          ok ? "bg-green" : "bg-muted-foreground/40",
        )}
      />
      {label}
      <span className="sr-only">{ok ? "verified" : "not verified"}</span>
    </span>
  );
}

const DomainRow: React.FC<{ domain: Domain }> = ({ domain }) => {
  const updateDomain = api.domain.updateDomain.useMutation();
  const utils = api.useUtils();
  const [clickTracking, setClickTracking] = React.useState(
    domain.clickTracking,
  );
  const [openTracking, setOpenTracking] = React.useState(domain.openTracking);

  React.useEffect(() => {
    setClickTracking(domain.clickTracking);
    setOpenTracking(domain.openTracking);
  }, [domain.clickTracking, domain.openTracking]);

  function updateTracking(
    field: "clickTracking" | "openTracking",
    value: boolean,
  ) {
    const setter =
      field === "clickTracking" ? setClickTracking : setOpenTracking;
    setter(value);
    updateDomain.mutate(
      { id: domain.id, [field]: value },
      {
        onSuccess: () => utils.domain.domains.invalidate(),
        onError: (error) => {
          setter(!value);
          toast.error(error.message);
        },
      },
    );
  }

  const href = `/domains/${domain.id}`;

  return (
    <TableRow className="group">
      <TableCell>
        <Link href={href} className="flex min-w-0 items-center gap-3">
          <span className="min-w-0">
            <span className="block truncate font-medium underline-offset-4 group-hover:underline">
              {domain.name}
            </span>
            <span className="block text-xs text-muted-foreground">
              {domain.region}
            </span>
          </span>
        </Link>
      </TableCell>
      <TableCell>
        <DomainStatusBadge status={domain.status} />
      </TableCell>
      <TableCell>
        <div className="flex gap-3">
          <DnsCheck
            label="DKIM"
            ok={domain.dkimStatus === DomainStatus.SUCCESS}
          />
          <DnsCheck
            label="SPF"
            ok={domain.spfDetails === DomainStatus.SUCCESS}
          />
          <DnsCheck label="DMARC" ok={domain.dmarcAdded} />
        </div>
      </TableCell>
      <TableCell>
        <Switch
          checked={openTracking}
          disabled={updateDomain.isPending}
          onCheckedChange={(v) => updateTracking("openTracking", v)}
          aria-label={`Open tracking for ${domain.name}`}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={clickTracking}
          disabled={updateDomain.isPending}
          onCheckedChange={(v) => updateTracking("clickTracking", v)}
          aria-label={`Click tracking for ${domain.name}`}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {formatDistanceToNow(new Date(domain.createdAt), { addSuffix: true })}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon" asChild>
          <Link href={href} aria-label={`Open ${domain.name}`}>
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
};

function DomainsLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading domains">
      <Skeleton className="h-10 w-full sm:w-72" />
      <div className="divide-y rounded-md border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-6 p-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DomainsEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed px-6 py-20 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
        <Globe className="size-5 text-muted-foreground" />
      </span>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No domains yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Add a domain and verify its DNS records to start sending.
        </p>
      </div>
      <AddDomain />
    </div>
  );
}
