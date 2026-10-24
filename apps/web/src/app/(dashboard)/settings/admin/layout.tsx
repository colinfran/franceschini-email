"use client";

import { SettingsNavButton } from "../../dev-settings/settings-nav-button";
import { isCloud } from "~/utils/common";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Admin</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your email infrastructure and manage platform access.
        </p>
      </div>
      <nav aria-label="Admin" className="flex flex-wrap gap-1">
        <SettingsNavButton href="/settings/admin">
          SES configurations
        </SettingsNavButton>
        {isCloud() ? (
          <SettingsNavButton href="/settings/admin/teams">
            Teams
          </SettingsNavButton>
        ) : null}
        {isCloud() ? (
          <SettingsNavButton href="/settings/admin/email-analytics">
            Email analytics
          </SettingsNavButton>
        ) : null}
      </nav>
      <div>{children}</div>
    </div>
  );
}
