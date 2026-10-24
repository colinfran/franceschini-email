CREATE TABLE "AppState" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6),

    CONSTRAINT "AppState_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "AppState_expiresAt_idx" ON "AppState"("expiresAt");
