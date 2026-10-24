"use client";

import EmailChart from "./email-chart";
import DashboardFilters from "./dashboard-filters";
import { H1 } from "@usesend/ui";
import { useUrlState } from "~/hooks/useUrlState";
import { ReputationMetrics } from "./reputation-metrics";

export default function Dashboard() {
  const [days, setDays] = useUrlState("days", "30");
  const [domain, setDomain] = useUrlState("domain");

  return (
    <div>
      <div className="w-full">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <H1>Analytics</H1>
            <p className="text-sm text-muted-foreground">
              A clear view of your email performance and sending reputation.
            </p>
          </div>
          <DashboardFilters
            days={days ?? "30"}
            setDays={setDays}
            domain={domain}
            setDomain={setDomain}
          />
        </div>
        <div className="space-y-6">
          <EmailChart days={Number(days ?? "30")} domain={domain} />

          <ReputationMetrics days={Number(days ?? "30")} domain={domain} />
        </div>
      </div>
    </div>
  );
}
