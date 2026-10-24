"use client";

import EmailList from "./email-list";
import { H1 } from "@usesend/ui";

export default function EmailsPage() {
  return (
    <div>
      <div className="space-y-1">
        <H1>Emails</H1>
        <p className="text-sm text-muted-foreground">
          Track every message from send to delivery.
        </p>
      </div>
      <EmailList />
    </div>
  );
}
