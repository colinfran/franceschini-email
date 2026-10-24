"use client";

import { useSession } from "next-auth/react";
import { H1 } from "@usesend/ui";
import { useTeam } from "~/providers/team-context";
import { isCloud, isSelfHosted } from "~/utils/common";
import { SettingsNavButton } from "../dev-settings/settings-nav-button";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentIsAdmin } = useTeam();
  const { data: session } = useSession();
  const showAdmin = !!session?.user.isAdmin || isSelfHosted();

  return (
    <div>
      <H1>Settings</H1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your account, team, DNS, and email infrastructure.
      </p>
      <nav
        aria-label="Settings"
        className="mt-6 flex flex-wrap gap-1 border-b pb-4"
      >
        <SettingsNavButton href="/settings">Account</SettingsNavButton>
        <SettingsNavButton href="/settings/team">Team</SettingsNavButton>
        <SettingsNavButton href="/settings/dns">DNS</SettingsNavButton>
        {showAdmin ? (
          <SettingsNavButton href="/settings/admin" matchNested>
            Admin
          </SettingsNavButton>
        ) : null}
        {isCloud() ? (
          <SettingsNavButton href="/settings/usage">Usage</SettingsNavButton>
        ) : null}
        {currentIsAdmin && isCloud() ? (
          <SettingsNavButton href="/settings/billing">
            Billing
          </SettingsNavButton>
        ) : null}
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
