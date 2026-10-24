"use client";

import DomainsList from "./domain-list";
import AddDomain from "./add-domain";
import { H1 } from "@usesend/ui";

export default function DomainsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <H1>Domains</H1>
          <p className="text-sm text-muted-foreground">
            Manage sending domains, DNS verification, and tracking.
          </p>
        </div>
        <AddDomain />
      </div>
      <DomainsList />
    </div>
  );
}
