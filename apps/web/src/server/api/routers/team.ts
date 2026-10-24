import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  teamProcedure,
  teamAdminProcedure,
} from "~/server/api/trpc";
import { TeamService } from "~/server/service/team-service";
import {
  getVercelCredentials,
  saveVercelCredentials,
  deleteVercelCredentials,
} from "~/server/service/vercel-settings-service";

export const teamRouter = createTRPCRouter({
  getVercelDnsSettings: teamProcedure.query(async ({ ctx }) => {
    const credentials = await getVercelCredentials(ctx.team.id);
    return {
      configured: credentials !== null,
      vercelTeamId: credentials?.vercelTeamId ?? "",
    };
  }),

  saveVercelDnsSettings: teamAdminProcedure
    .input(
      z.object({
        token: z
          .string()
          .trim()
          .min(1)
          .max(512)
          .regex(/^[^\s]+$/)
          .optional(),
        vercelTeamId: z.string().trim().max(128).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await saveVercelCredentials(ctx.team.id, input);
      return { success: true };
    }),

  deleteVercelDnsSettings: teamAdminProcedure.mutation(async ({ ctx }) => {
    await deleteVercelCredentials(ctx.team.id);
    return { success: true };
  }),

  createTeam: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return TeamService.createTeam(ctx.session.user.id, input.name);
    }),

  getTeams: protectedProcedure.query(async ({ ctx }) => {
    return TeamService.getUserTeams(ctx.session.user.id);
  }),

  getTeamUsers: teamProcedure.query(async ({ ctx }) => {
    return TeamService.getTeamUsers(ctx.team.id);
  }),

  getTeamInvites: teamProcedure.query(async ({ ctx }) => {
    return TeamService.getTeamInvites(ctx.team.id);
  }),

  createTeamInvite: teamAdminProcedure
    .input(
      z.object({
        email: z.string(),
        role: z.enum(["MEMBER", "ADMIN"]),
        sendEmail: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return TeamService.createTeamInvite(
        ctx.team.id,
        input.email,
        input.role,
        ctx.team.name,
        input.sendEmail,
      );
    }),

  updateTeamUserRole: teamAdminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(["MEMBER", "ADMIN"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return TeamService.updateTeamUserRole(
        ctx.team.id,
        input.userId,
        input.role,
      );
    }),

  deleteTeamUser: teamProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return TeamService.deleteTeamUser(
        ctx.team.id,
        input.userId,
        ctx.teamUser.role,
        ctx.session.user.id,
      );
    }),

  resendTeamInvite: teamAdminProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return TeamService.resendTeamInvite(
        ctx.team.id,
        input.inviteId,
        ctx.team.name,
      );
    }),

  deleteTeamInvite: teamAdminProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return TeamService.deleteTeamInvite(ctx.team.id, input.inviteId);
    }),
});
