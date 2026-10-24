import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDb,
  configureVercelDns,
  buildDnsRecords,
  getVercelCredentials,
  saveVercelCredentials,
  deleteVercelCredentials,
} = vi.hoisted(() => ({
  mockDb: {
    teamUser: { findFirst: vi.fn() },
    domain: { findUnique: vi.fn() },
  },
  configureVercelDns: vi.fn(),
  buildDnsRecords: vi.fn(),
  getVercelCredentials: vi.fn(),
  saveVercelCredentials: vi.fn(),
  deleteVercelCredentials: vi.fn(),
}));

vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("~/server/auth", () => ({ getServerAuthSession: vi.fn() }));
vi.mock("~/server/service/domain-service", () => ({
  buildDnsRecords,
  createDomain: vi.fn(),
  deleteDomain: vi.fn(),
  getDomain: vi.fn(),
  getDomains: vi.fn(),
  updateDomain: vi.fn(),
}));
vi.mock("~/server/service/vercel-dns-service", () => ({ configureVercelDns }));
vi.mock("~/server/service/vercel-settings-service", () => ({
  getVercelCredentials,
  saveVercelCredentials,
  deleteVercelCredentials,
}));
vi.mock("~/server/service/team-service", () => ({ TeamService: {} }));
vi.mock("~/server/service/email-service", () => ({ sendEmail: vi.fn() }));
vi.mock("~/server/service/ses-settings-service", () => ({
  SesSettingsService: {},
}));

import { db } from "~/server/db";
import { createCallerFactory, createTRPCContext } from "~/server/api/trpc";
import { domainRouter } from "./domain";
import { teamRouter } from "./team";

const createCaller = createCallerFactory(domainRouter);
const createTeamCaller = createCallerFactory(teamRouter);
const domain = { id: 7, name: "news.example.com", teamId: 10 };
const records = [
  {
    type: "TXT",
    name: "mail.news",
    value: "v=spf1 include:amazonses.com ~all",
  },
];

function context(): Awaited<ReturnType<typeof createTRPCContext>> {
  return {
    db,
    headers: new Headers(),
    session: {
      expires: "2099-01-01",
      user: {
        id: 42,
        email: "owner@example.com",
        isWaitlisted: false,
        isAdmin: false,
        isBetaUser: false,
      },
    },
  };
}

describe("domain.configureVercelDns", () => {
  beforeEach(() => {
    mockDb.teamUser.findFirst.mockResolvedValue({
      team: { id: 10 },
      role: "ADMIN",
    });
    mockDb.domain.findUnique.mockResolvedValue(domain);
    buildDnsRecords.mockReturnValue(records);
    getVercelCredentials.mockResolvedValue({
      token: "saved-token",
      vercelTeamId: "team_123",
    });
    configureVercelDns.mockResolvedValue({
      created: 1,
      skipped: 0,
      zone: "example.com",
    });
  });

  it("scopes the domain to the authenticated team and uses server-generated records", async () => {
    const result = await createCaller(context()).configureVercelDns({
      id: 7,
    });
    expect(mockDb.domain.findUnique).toHaveBeenCalledWith({
      where: { id: 7, teamId: 10 },
    });
    expect(buildDnsRecords).toHaveBeenCalledWith(domain);
    expect(configureVercelDns).toHaveBeenCalledWith({
      domainName: domain.name,
      records,
      token: "saved-token",
      teamId: "team_123",
    });
    expect(getVercelCredentials).toHaveBeenCalledWith(10);
    expect(result).toEqual({ created: 1, skipped: 0, zone: "example.com" });
  });

  it("rejects an unauthenticated request", async () => {
    await expect(
      createCaller({ ...context(), session: null }).configureVercelDns({
        id: 7,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(configureVercelDns).not.toHaveBeenCalled();
  });

  it("rejects domains outside the authenticated team", async () => {
    mockDb.domain.findUnique.mockResolvedValue(null);
    await expect(
      createCaller(context()).configureVercelDns({
        id: 99,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(configureVercelDns).not.toHaveBeenCalled();
  });

  it("directs users to settings when no connection is saved", async () => {
    getVercelCredentials.mockResolvedValue(null);
    await expect(
      createCaller(context()).configureVercelDns({ id: 7 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(configureVercelDns).not.toHaveBeenCalled();
  });

  it("returns only connection metadata, never the saved token", async () => {
    expect(await createTeamCaller(context()).getVercelDnsSettings()).toEqual({
      configured: true,
      vercelTeamId: "team_123",
    });
  });

  it("reports an unconfigured connection", async () => {
    getVercelCredentials.mockResolvedValue(null);
    expect(await createTeamCaller(context()).getVercelDnsSettings()).toEqual({
      configured: false,
      vercelTeamId: "",
    });
  });

  it("allows admins to save trimmed credentials only for their team", async () => {
    expect(
      await createTeamCaller(context()).saveVercelDnsSettings({
        token: " token ",
        vercelTeamId: " team_123 ",
      }),
    ).toEqual({ success: true });
    expect(saveVercelCredentials).toHaveBeenCalledWith(10, {
      token: "token",
      vercelTeamId: "team_123",
    });
  });

  it("allows admins to update team scope while keeping the saved token", async () => {
    await createTeamCaller(context()).saveVercelDnsSettings({
      vercelTeamId: "team_new",
    });
    expect(saveVercelCredentials).toHaveBeenCalledWith(10, {
      vercelTeamId: "team_new",
    });
  });

  it("removes the connection only for the authenticated team", async () => {
    await createTeamCaller(context()).deleteVercelDnsSettings();
    expect(deleteVercelCredentials).toHaveBeenCalledWith(10);
  });

  it("prevents members from saving or removing credentials", async () => {
    mockDb.teamUser.findFirst.mockResolvedValue({
      team: { id: 10 },
      role: "MEMBER",
    });
    const caller = createTeamCaller(context());
    await expect(
      caller.saveVercelDnsSettings({ token: "token" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.deleteVercelDnsSettings()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(saveVercelCredentials).not.toHaveBeenCalled();
    expect(deleteVercelCredentials).not.toHaveBeenCalled();
  });

  it.each(["", "   ", "bad\ntoken"])(
    "rejects an invalid saved token",
    async (token) => {
      await expect(
        createTeamCaller(context()).saveVercelDnsSettings({ token }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(saveVercelCredentials).not.toHaveBeenCalled();
    },
  );
});
