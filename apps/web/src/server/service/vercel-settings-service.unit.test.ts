import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockEnv } = vi.hoisted(() => ({
  mockDb: {
    appSetting: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
  mockEnv: { NEXTAUTH_SECRET: "test-encryption-secret" },
}));
vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("~/env", () => ({ env: mockEnv }));

import {
  deleteVercelCredentials,
  getVercelCredentials,
  saveVercelCredentials,
} from "./vercel-settings-service";

describe("Vercel settings persistence", () => {
  beforeEach(() => {
    mockEnv.NEXTAUTH_SECRET = "test-encryption-secret";
    mockDb.appSetting.findUnique.mockResolvedValue(null);
  });

  async function storedCredentials() {
    await saveVercelCredentials(10, {
      token: "vercel-secret-token",
      vercelTeamId: "team_123",
    });
    const stored = mockDb.appSetting.upsert.mock.calls[0]![0].create;
    mockDb.appSetting.findUnique.mockResolvedValue(stored);
    return stored;
  }

  it("persists encrypted credentials under a team-specific key and decrypts them for reuse", async () => {
    const stored = await storedCredentials();
    expect(stored.key).toBe("team:10:vercel-dns");
    expect(stored.value).not.toContain("vercel-secret-token");
    expect(stored.value).not.toContain("team_123");
    expect(await getVercelCredentials(10)).toEqual({
      token: "vercel-secret-token",
      vercelTeamId: "team_123",
    });
    expect(mockDb.appSetting.findUnique).toHaveBeenCalledWith({
      where: { key: "team:10:vercel-dns" },
    });
  });

  it("keeps the saved token when only the Vercel team ID changes", async () => {
    await storedCredentials();
    await saveVercelCredentials(10, { vercelTeamId: "team_new" });
    mockDb.appSetting.findUnique.mockResolvedValue(
      mockDb.appSetting.upsert.mock.calls[1]![0].create,
    );
    expect(await getVercelCredentials(10)).toEqual({
      token: "vercel-secret-token",
      vercelTeamId: "team_new",
    });
  });

  it("can replace a token without needing to decrypt the old credentials", async () => {
    mockDb.appSetting.findUnique.mockResolvedValue({ value: "corrupted" });
    await saveVercelCredentials(10, { token: "replacement" });
    expect(mockDb.appSetting.findUnique).not.toHaveBeenCalled();
    expect(mockDb.appSetting.upsert).toHaveBeenCalled();
  });

  it("uses a fresh nonce each time credentials are saved", async () => {
    await saveVercelCredentials(10, { token: "same-token" });
    await saveVercelCredentials(10, { token: "same-token" });
    expect(mockDb.appSetting.upsert.mock.calls[0]![0].create.value).not.toBe(
      mockDb.appSetting.upsert.mock.calls[1]![0].create.value,
    );
  });

  it("returns null for an unconfigured team", async () => {
    expect(await getVercelCredentials(10)).toBeNull();
  });

  it("requires a token on the first save", async () => {
    await expect(saveVercelCredentials(10, {})).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mockDb.appSetting.upsert).not.toHaveBeenCalled();
  });

  it("requires a configured encryption secret", async () => {
    mockEnv.NEXTAUTH_SECRET = "";
    await expect(
      saveVercelCredentials(10, { token: "token" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mockDb.appSetting.upsert).not.toHaveBeenCalled();
  });

  it("rejects credentials copied from a different team", async () => {
    await storedCredentials();
    await expect(getVercelCredentials(20)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  it("reports encryption key changes explicitly", async () => {
    await storedCredentials();
    mockEnv.NEXTAUTH_SECRET = "changed-secret";
    await expect(getVercelCredentials(10)).rejects.toThrow(
      "Keep NEXTAUTH_SECRET stable",
    );
  });

  it("reports corrupt stored values explicitly", async () => {
    mockDb.appSetting.findUnique.mockResolvedValue({ value: "invalid" });
    await expect(getVercelCredentials(10)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  it("removes only the requested team's credentials", async () => {
    await deleteVercelCredentials(10);
    expect(mockDb.appSetting.deleteMany).toHaveBeenCalledWith({
      where: { key: "team:10:vercel-dns" },
    });
  });
});
