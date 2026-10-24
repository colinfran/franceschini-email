import { subDays } from "date-fns";
import { db } from "~/server/db";
import { Queue, Worker } from "~/server/queue/postgres-queue";
import { WEBHOOK_CLEANUP_QUEUE } from "../queue/queue-constants";
import { logger } from "../logger/log";
import { deleteExpiredState } from "../postgres-state";

const WEBHOOK_RETENTION_DAYS = 30;

let initialized = false;

export async function initWebhookCleanupJob() {
  if (initialized) {
    return;
  }

  const webhookCleanupQueue = new Queue(WEBHOOK_CLEANUP_QUEUE);
  const worker = new Worker(
    WEBHOOK_CLEANUP_QUEUE,
    async () => {
      const cutoff = subDays(new Date(), WEBHOOK_RETENTION_DAYS);
      const result = await db.webhookCall.deleteMany({
        where: {
          createdAt: {
            lt: cutoff,
          },
        },
      });
      const expiredStateRows = await deleteExpiredState();

      logger.info(
        {
          deleted: result.count,
          expiredStateRows,
          cutoff: cutoff.toISOString(),
        },
        "[WebhookCleanupJob]: Deleted old webhook calls",
      );
    },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "[WebhookCleanupJob]: Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id }, "[WebhookCleanupJob]: Job failed");
  });

  await webhookCleanupQueue.upsertJobScheduler("webhook-cleanup-daily", {
    pattern: "0 3 * * *",
    tz: "UTC",
  });

  initialized = true;
}
