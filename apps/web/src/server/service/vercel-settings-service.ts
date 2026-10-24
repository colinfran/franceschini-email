import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "~/env";
import { db } from "~/server/db";

const credentialsSchema = z.object({
  token: z.string().min(1),
  vercelTeamId: z.string().optional(),
});
const storedSchema = z.object({
  version: z.literal(1),
  iv: z.string(),
  tag: z.string(),
  data: z.string(),
});

const settingKey = (teamId: number) => `team:${teamId}:vercel-dns`;

function encryptionKey() {
  if (!env.NEXTAUTH_SECRET) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Set NEXTAUTH_SECRET before saving Vercel credentials.",
    });
  }
  return scryptSync(env.NEXTAUTH_SECRET, "usesend:vercel-dns:v1", 32);
}

export async function getVercelCredentials(teamId: number) {
  const setting = await db.appSetting.findUnique({
    where: { key: settingKey(teamId) },
  });
  if (!setting) return null;
  const key = encryptionKey();
  try {
    const stored = storedSchema.parse(JSON.parse(setting.value));
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(stored.iv, "base64"),
    );
    decipher.setAAD(Buffer.from(settingKey(teamId)));
    decipher.setAuthTag(Buffer.from(stored.tag, "base64"));
    const value = Buffer.concat([
      decipher.update(Buffer.from(stored.data, "base64")),
      decipher.final(),
    ]).toString("utf8");
    return credentialsSchema.parse(JSON.parse(value));
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Unable to decrypt Vercel settings. Ask a team admin to remove and save the credentials again. Keep NEXTAUTH_SECRET stable across deployments.",
    });
  }
}

export async function saveVercelCredentials(
  teamId: number,
  input: { token?: string; vercelTeamId?: string },
) {
  const token = input.token ?? (await getVercelCredentials(teamId))?.token;
  if (!token) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A Vercel API token is required.",
    });
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(settingKey(teamId)));
  const data = Buffer.concat([
    cipher.update(
      JSON.stringify({ token, vercelTeamId: input.vercelTeamId }),
      "utf8",
    ),
    cipher.final(),
  ]);
  const value = JSON.stringify({
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  });
  await db.appSetting.upsert({
    where: { key: settingKey(teamId) },
    create: { key: settingKey(teamId), value },
    update: { value },
  });
}

export async function deleteVercelCredentials(teamId: number) {
  await db.appSetting.deleteMany({ where: { key: settingKey(teamId) } });
}
