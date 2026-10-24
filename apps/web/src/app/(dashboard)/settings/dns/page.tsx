"use client";

import { useState } from "react";
import { Button } from "@usesend/ui/src/button";
import { Input } from "@usesend/ui/src/input";
import { Label } from "@usesend/ui/src/label";
import { toast } from "@usesend/ui/src/toaster";
import { useTeam } from "~/providers/team-context";
import { api } from "~/trpc/react";

export default function DnsSettingsPage() {
  const settings = api.team.getVercelDnsSettings.useQuery();
  if (settings.isLoading) return <p>Loading DNS settings...</p>;
  if (settings.isError)
    return (
      <div>
        <p role="alert">{settings.error.message}</p>
        <VercelSettings configured={false} vercelTeamId="" loadError />
      </div>
    );
  if (!settings.data) return null;
  return <VercelSettings {...settings.data} />;
}

function VercelSettings({
  configured,
  vercelTeamId,
  loadError = false,
}: {
  configured: boolean;
  vercelTeamId: string;
  loadError?: boolean;
}) {
  const { currentIsAdmin } = useTeam();
  const [token, setToken] = useState("");
  const [teamId, setTeamId] = useState(vercelTeamId);
  const utils = api.useUtils();
  const save = api.team.saveVercelDnsSettings.useMutation({
    gcTime: 0,
    onSuccess: () => {
      toast.success("Vercel DNS settings saved");
      void utils.team.getVercelDnsSettings.invalidate();
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      setToken("");
      save.reset();
    },
  });
  const remove = api.team.deleteVercelDnsSettings.useMutation({
    onSuccess: () => {
      setToken("");
      setTeamId("");
      toast.success("Vercel connection removed");
      void utils.team.getVercelDnsSettings.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const pending = save.isPending || remove.isPending;

  return (
    <div className="max-w-xl space-y-4 rounded-lg border p-4">
      <h2 className="text-xl font-semibold">Vercel DNS</h2>
      <p className="text-sm text-muted-foreground">
        Save a Vercel API token once to add DNS records for any of your team's
        domains without entering credentials again. The token is stored
        encrypted and is never returned to your browser.
      </p>
      <p>
        {loadError
          ? "Vercel connection needs attention."
          : configured
            ? "Vercel is connected."
            : "Vercel is not connected."}
      </p>
      {!currentIsAdmin ? (
        <p>Only team admins can manage this connection.</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({
              token: token.trim() || undefined,
              vercelTeamId: teamId.trim() || undefined,
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="vercel-token">Vercel API token</Label>
            <Input
              id="vercel-token"
              type="password"
              autoComplete="off"
              placeholder={
                configured
                  ? "Leave blank to keep the saved token"
                  : "Enter your Vercel API token"
              }
              required={!configured}
              maxLength={512}
              value={token}
              disabled={pending}
              onChange={(event) => setToken(event.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Create a token with access to your domains in{" "}
              <a
                className="underline"
                href="https://vercel.com/account/tokens"
                target="_blank"
                rel="noreferrer"
              >
                Vercel account settings
              </a>
              .
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vercel-team">Vercel team ID (optional)</Label>
            <Input
              id="vercel-team"
              placeholder="team_..."
              maxLength={128}
              value={teamId}
              disabled={pending}
              onChange={(event) => setTeamId(event.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              For team-owned domains, copy the team ID from Vercel team
              settings.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={pending || (!configured && !token.trim())}
            >
              {save.isPending ? "Saving..." : "Save connection"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? "Removing..." : "Remove connection"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
