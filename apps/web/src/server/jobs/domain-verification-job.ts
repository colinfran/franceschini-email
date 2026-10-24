import { Queue, Worker } from "~/server/queue/postgres-queue";
import { db } from "~/server/db";
import { logger } from "~/server/logger/log";
import { DOMAIN_VERIFICATION_QUEUE } from "~/server/queue/queue-constants";
import {
  isDomainVerificationDue,
  refreshDomainVerification,
} from "~/server/service/domain-service";

let initialized = false;

export async function runDueDomainVerifications() {
  const domains = await db.domain.findMany({
    orderBy: {
      createdAt: "asc",
    },
  });

  for (const domain of domains) {
    try {
      const isDue = await isDomainVerificationDue(domain);
      if (!isDue) {
        continue;
      }

      await refreshDomainVerification(domain);
    } catch (error) {
      logger.error(
        { err: error, domainId: domain.id },
        "[DomainVerificationJob]: Failed to refresh domain verification",
      );
    }
  }
}

export async function initDomainVerificationJob() {
  if (initialized) {
    return;
  }

  const domainVerificationQueue = new Queue(DOMAIN_VERIFICATION_QUEUE);

  const worker = new Worker(
    DOMAIN_VERIFICATION_QUEUE,
    async () => {
      await runDueDomainVerifications();
    },
    {
      concurrency: 1,
    },
  );

  await domainVerificationQueue.upsertJobScheduler(
    "domain-verification-hourly",
    {
      pattern: "0 * * * *",
      tz: "UTC",
    },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "[DomainVerificationJob]: Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { err, jobId: job?.id },
      "[DomainVerificationJob]: Job failed",
    );
  });

  initialized = true;
}
