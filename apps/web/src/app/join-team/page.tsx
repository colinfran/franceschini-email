import JoinTeam from "~/components/team/JoinTeam";
import { Suspense } from "react";
import Spinner from "@usesend/ui/src/spinner";
import { getServerAuthSession } from "~/server/auth";
import { redirect } from "next/navigation";
import { Card } from "@usesend/ui/src/card";

export default async function CreateTeam({
  searchParams,
}: {
  searchParams: Promise<{ inviteId?: string }>;
}) {
  const session = await getServerAuthSession();
  const params = await searchParams;

  if (!session) {
    const inviteId = params?.inviteId;
    redirect(`/login${inviteId ? `?inviteId=${inviteId}` : ""}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="flex w-full max-w-md flex-col gap-8 p-6">
        <Suspense
          fallback={
            <div className="flex justify-center">
              <Spinner className="h-5 w-5" innerSvgClass="stroke-primary" />
            </div>
          }
        >
          <JoinTeam />
        </Suspense>
      </Card>
    </div>
  );
}
