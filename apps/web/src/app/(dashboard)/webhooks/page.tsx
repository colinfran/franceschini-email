"use client";

import { H1 } from "@usesend/ui";
import { AddWebhook } from "./add-webhook";
import { WebhookList } from "./webhook-list";

export default function WebhooksPage() {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <H1>Webhooks</H1>
          <p className="text-sm text-muted-foreground">
            Connect email events to your applications.
          </p>
        </div>
        <AddWebhook />
      </div>
      <WebhookList />
    </div>
  );
}
