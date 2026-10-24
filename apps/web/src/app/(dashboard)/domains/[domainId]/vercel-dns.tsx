"use client";

import { useState } from "react";
import Link from "next/link";
import { getDomain } from "tldts";
import { Button } from "@usesend/ui/src/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@usesend/ui/src/dialog";
import { toast } from "@usesend/ui/src/toaster";
import { api } from "~/trpc/react";

export default function VercelDns({
  domain,
}: {
  domain: { id: number; name: string };
}) {
  const [open, setOpen] = useState(false);
  const settings = api.team.getVercelDnsSettings.useQuery();
  const mutation = api.domain.configureVercelDns.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Added ${result.created} DNS records; ${result.skipped} already configured or preserved. Allow time for DNS propagation, then click Verify domain.`,
      );
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Add records to Vercel</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set up DNS with Vercel</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Add the DNS records shown on this page to {getDomain(domain.name)}{" "}
          using your saved Vercel connection. This domain must use Vercel
          nameservers. Matching records and existing DMARC policies are
          preserved; conflicting records are never overwritten.
        </p>
        {settings.isError ? <p role="alert">{settings.error.message}</p> : null}
        {settings.data && !settings.data.configured ? (
          <p>
            Connect your Vercel account once in{" "}
            <Link
              className="underline"
              href="/settings/dns"
              onClick={() => setOpen(false)}
            >
              Settings &gt; DNS
            </Link>
            . Your saved connection will be reused for all domains.
          </p>
        ) : null}
        <Button
          disabled={!settings.data?.configured || mutation.isPending}
          onClick={() => mutation.mutate({ id: domain.id })}
        >
          {mutation.isPending ? "Adding records..." : "Add DNS records"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
