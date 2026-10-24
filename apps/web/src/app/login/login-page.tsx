"use client";

import { useState } from "react";
import { type ClientSafeProvider, signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@usesend/ui/src/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@usesend/ui/src/card";
import Spinner from "@usesend/ui/src/spinner";
import { AppLogo } from "~/components/AppLogo";
import { getAuthErrorMessage } from "./auth-error";

function GitHubIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 496 512"
      aria-hidden="true"
      className="size-4 fill-current"
    >
      <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3 .3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5 .3-6.2 2.3zm44.2-1.7c-2.9 .7-4.9 2.6-4.6 4.9 .3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3 .7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3 .3 2.9 2.3 3.9 1.6 1 3.6 .7 4.3-.7 .7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3 .7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3 .7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z" />
    </svg>
  );
}

export default function LoginPage({
  providers,
}: {
  providers?: ClientSafeProvider[];
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useSearchParams();
  const inviteId = searchParams.get("inviteId");
  const authErrorMessage = getAuthErrorMessage(searchParams.get("error"));
  const githubProvider = providers?.find(
    (provider) => provider.id === "github",
  );

  const handleGitHubSignIn = () => {
    setIsSubmitting(true);
    const callbackUrl = inviteId
      ? `/join-team?inviteId=${encodeURIComponent(inviteId)}`
      : "/dashboard";
    void signIn("github", { callbackUrl });
  };

  return (
    <main className="relative grid min-h-svh lg:grid-cols-2">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 sm:p-6">
        <Link
          href="/"
          className="flex items-center gap-3 font-semibold tracking-tight"
        >
          <AppLogo />
          Franceschini Email
        </Link>
      </header>
      <div className="hidden flex-col justify-center border-r bg-muted/40 p-12 lg:flex xl:p-20">
        <p className="mb-6 text-sm font-medium text-muted-foreground">
          PRIVATE WORKSPACE
        </p>
        <h1 className="max-w-lg text-5xl font-semibold leading-tight tracking-tight xl:text-6xl">
          Franceschini
          <br />
          Email
        </h1>
        <p className="mt-6 max-w-sm text-lg leading-relaxed text-muted-foreground">
          My personal console for sending mail and tracking delivery.
        </p>
      </div>
      <div className="flex items-center justify-center px-4 py-28 sm:px-8">
        <div className="w-full max-w-sm space-y-6">
          <Card className="bg-card shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl tracking-tight">Sign in</CardTitle>
              <CardDescription>Private access with GitHub.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {authErrorMessage ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  {authErrorMessage}
                </p>
              ) : null}
              {githubProvider ? (
                <Button
                  className="w-full gap-2"
                  size="lg"
                  disabled={isSubmitting}
                  onClick={handleGitHubSignIn}
                >
                  {isSubmitting ? (
                    <Spinner
                      className="size-4"
                      innerSvgClass="stroke-current"
                    />
                  ) : (
                    <GitHubIcon />
                  )}
                  Continue with GitHub
                </Button>
              ) : (
                <p role="alert" className="text-sm text-destructive">
                  GitHub sign-in is not configured. Contact your administrator.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
