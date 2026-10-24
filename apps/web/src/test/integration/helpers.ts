import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import {
  clearPostgresQueue,
  stopPostgresQueue,
} from "~/server/queue/postgres-queue";

export const integrationEnabled = process.env.RUN_INTEGRATION === "true";

export async function resetDatabase() {
  await clearPostgresQueue();
  const rows = await db.$queryRaw<Array<{ tablename: string }>>(Prisma.sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename != '_prisma_migrations'
  `);

  if (rows.length === 0) {
    return;
  }

  const tables = rows.map((row) => `"public"."${row.tablename}"`).join(", ");

  await db.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`,
  );
}

export async function resetAppState() {
  await db.$executeRaw`DELETE FROM "AppState"`;
}

export async function closeIntegrationConnections() {
  await stopPostgresQueue();
  await db.$disconnect();
}
