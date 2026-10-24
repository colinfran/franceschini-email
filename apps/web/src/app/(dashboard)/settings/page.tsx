"use client";

import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@usesend/ui/src/avatar";
import { Badge } from "@usesend/ui/src/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@usesend/ui/src/card";
import { Separator } from "@usesend/ui/src/separator";
import { useTeam } from "~/providers/team-context";

export default function AccountSettingsPage() {
  const { data: session } = useSession();
  const { currentTeam, currentRole } = useTeam();
  const user = session?.user;
  const displayName = user?.name || user?.email?.split("@")[0] || "User";

  const details = [
    { label: "Name", value: user?.name || "Not set" },
    { label: "Email", value: user?.email || "Not set" },
    { label: "Team", value: currentTeam?.name || "—" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>
          Your profile details come from your GitHub account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 rounded-xl">
            {user?.image ? (
              <AvatarImage src={user.image} alt={displayName} />
            ) : null}
            <AvatarFallback className="rounded-xl text-lg capitalize">
              {displayName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <p className="truncate text-lg font-semibold">{displayName}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="capitalize">
                {currentRole.toLowerCase()}
              </Badge>
              {user?.isAdmin ? <Badge variant="outline">Admin</Badge> : null}
            </div>
          </div>
        </div>
        <Separator />
        <dl className="grid gap-4 sm:grid-cols-3">
          {details.map((item) => (
            <div key={item.label} className="min-w-0 space-y-1">
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
              <dd className="truncate text-sm font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
