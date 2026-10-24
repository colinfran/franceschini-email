import { db } from "~/server/db";

type StateRow = {
  value: string;
};

export async function getState(key: string): Promise<string | null> {
  const rows = await db.$queryRaw<StateRow[]>`
    SELECT "value"
    FROM "AppState"
    WHERE "key" = ${key}
      AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
  `;
  return rows[0]?.value ?? null;
}

export async function getStates(keys: string[]): Promise<(string | null)[]> {
  if (keys.length === 0) {
    return [];
  }

  const rows = await db.$queryRaw<Array<{ key: string; value: string }>>`
    SELECT "key", "value"
    FROM "AppState"
    WHERE "key" = ANY(${keys}::text[])
      AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
  `;
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return keys.map((key) => values.get(key) ?? null);
}

export async function setState(
  key: string,
  value: string,
  ttlSeconds?: number,
): Promise<void> {
  await db.$executeRaw`
    INSERT INTO "AppState" ("key", "value", "expiresAt")
    VALUES (
      ${key},
      ${value},
      ${ttlSeconds === undefined ? null : new Date(Date.now() + ttlSeconds * 1000)}
    )
    ON CONFLICT ("key") DO UPDATE
    SET "value" = EXCLUDED."value", "expiresAt" = EXCLUDED."expiresAt"
  `;
}

export async function setStateIfAbsent(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ key: string }>>`
    INSERT INTO "AppState" ("key", "value", "expiresAt")
    VALUES (${key}, ${value}, NOW() + (${ttlSeconds} * INTERVAL '1 second'))
    ON CONFLICT ("key") DO UPDATE
    SET "value" = EXCLUDED."value", "expiresAt" = EXCLUDED."expiresAt"
    WHERE "AppState"."expiresAt" IS NOT NULL
      AND "AppState"."expiresAt" <= NOW()
    RETURNING "key"
  `;
  return rows.length > 0;
}

export async function incrementState(
  key: string,
  ttlSeconds?: number,
): Promise<number> {
  const rows = await db.$queryRaw<Array<{ value: string }>>`
    INSERT INTO "AppState" ("key", "value", "expiresAt")
    VALUES (
      ${key},
      '1',
      ${ttlSeconds === undefined ? null : new Date(Date.now() + ttlSeconds * 1000)}
    )
    ON CONFLICT ("key") DO UPDATE
    SET
      "value" = CASE
        WHEN "AppState"."expiresAt" IS NOT NULL AND "AppState"."expiresAt" <= NOW()
          THEN '1'
        ELSE ("AppState"."value"::bigint + 1)::text
      END,
      "expiresAt" = CASE
        WHEN "AppState"."expiresAt" IS NOT NULL AND "AppState"."expiresAt" <= NOW()
          THEN EXCLUDED."expiresAt"
        ELSE "AppState"."expiresAt"
      END
    RETURNING "value"
  `;
  return Number(rows[0]?.value);
}

export async function expireState(key: string, ttlSeconds: number): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ key: string }>>`
    UPDATE "AppState"
    SET "expiresAt" = NOW() + (${ttlSeconds} * INTERVAL '1 second')
    WHERE "key" = ${key}
      AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
    RETURNING "key"
  `;
  return rows.length > 0;
}

export async function getStateTtl(key: string): Promise<number> {
  const rows = await db.$queryRaw<Array<{ ttl: number | null }>>`
    SELECT CASE
      WHEN "expiresAt" IS NULL THEN -1
      ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ("expiresAt" - NOW()))))::int
    END AS "ttl"
    FROM "AppState"
    WHERE "key" = ${key}
      AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
  `;
  return rows[0]?.ttl ?? -2;
}

export async function deleteState(...keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }

  await db.$executeRaw`
    DELETE FROM "AppState"
    WHERE "key" = ANY(${keys}::text[])
  `;
}

export async function deleteStateIfValue(
  key: string,
  value: string,
): Promise<void> {
  await db.$executeRaw`
    DELETE FROM "AppState"
    WHERE "key" = ${key} AND "value" = ${value}
  `;
}

export async function deleteExpiredState(): Promise<number> {
  return db.$executeRaw`
    DELETE FROM "AppState"
    WHERE "expiresAt" <= NOW()
  `;
}

export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttlSeconds?: number; disable?: boolean },
): Promise<T> {
  const { ttlSeconds = 120, disable = false } = options ?? {};

  if (!disable) {
    const cached = await getState(key);
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch {
        // Refresh values that were not stored as valid JSON.
      }
    }
  }

  const value = await fetcher();
  if (!disable) {
    await setState(key, JSON.stringify(value), ttlSeconds);
  }
  return value;
}
