"use client";

import { H1 } from "@usesend/ui";
import { SettingsNavButton } from "./settings-nav-button";

export const dynamic = "force-static";

export default function ApiKeysPage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <H1>Developer Settings</H1>
      <p className="mt-1 text-sm text-muted-foreground">
        Connect your applications with API keys and SMTP.
      </p>
      <nav
        aria-label="Developer settings"
        className="mt-6 flex flex-wrap gap-1 border-b pb-4"
      >
        <SettingsNavButton href="/dev-settings">API Keys</SettingsNavButton>
        <SettingsNavButton href="/dev-settings/smtp">SMTP</SettingsNavButton>
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
