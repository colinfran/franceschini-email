"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@usesend/ui/src/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@usesend/ui/src/form";
import { Input } from "@usesend/ui/src/input";
import { Spinner } from "@usesend/ui/src/spinner";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { toast } from "@usesend/ui/src/toaster";
import JoinTeam from "./JoinTeam";
import { Card } from "@usesend/ui/src/card";
import { AppLogo } from "~/components/AppLogo";

const FormSchema = z.object({
  name: z.string().min(2, {
    message: "Team name must be at least 2 characters.",
  }),
});

export default function CreateTeam() {
  const createTeam = api.team.createTeam.useMutation();
  const utils = api.useUtils();

  const router = useRouter();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    createTeam.mutate(data, {
      onSuccess: () => {
        utils.team.invalidate();
        router.replace("/dashboard");
      },
      onError: (e) => {
        toast.error(e.message);
      },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="flex w-full max-w-md flex-col gap-6 p-6">
        <AppLogo className="mx-auto" />
        <JoinTeam showCreateTeam />
        <div>
          <h1 className="text-center text-2xl font-semibold tracking-tight">
            Create your workspace
          </h1>
        </div>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className=" flex flex-col gap-8 w-full"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field, formState }) => (
                <FormItem>
                  <FormLabel>Team name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Team name"
                      className="w-full"
                      {...field}
                    />
                  </FormControl>
                  {formState.errors.name ? (
                    <FormMessage />
                  ) : (
                    <FormDescription>
                      Request admin to join existing team
                    </FormDescription>
                  )}
                </FormItem>
              )}
            />
            <Button type="submit" disabled={createTeam.isPending}>
              {createTeam.isPending ? (
                <Spinner className="w-5 h-5" />
              ) : (
                "Create"
              )}
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
}
