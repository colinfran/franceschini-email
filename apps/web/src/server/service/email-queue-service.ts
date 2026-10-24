import { Queue, Worker } from "../queue/postgres-queue";
import { env } from "~/env";
import { type EmailAttachment } from "~/types";
import { getConfigurationSetName } from "~/utils/ses-utils";
import { db } from "../db";
import { sendRawEmail } from "../aws/ses";
import { logger } from "../logger/log";
import { createWorkerHandler, type TeamJob } from "../queue/job-context";
import { LimitService } from "./limit-service";

type QueueEmailData = {
  emailId: string;
  timestamp: number;
  teamId?: number;
};
type QueueEmailJob = TeamJob<QueueEmailData>;
type EmailQueueEntry = {
  queue: Queue<QueueEmailData>;
  worker: Worker<QueueEmailData>;
};

const globalForEmailQueue = globalThis as typeof globalThis & {
  transactionalEmailQueueState?: {
    initPromise?: Promise<void>;
    regions: Map<string, EmailQueueEntry>;
  };
};
const emailQueueState: NonNullable<
  typeof globalForEmailQueue.transactionalEmailQueueState
> = (globalForEmailQueue.transactionalEmailQueueState ??= {
  regions: new Map(),
});

export class EmailQueueService {
  public static initializeQueue(region: string, quota: number) {
    const concurrency = Math.max(1, Math.floor(quota));
    const existing = emailQueueState.regions.get(region);
    if (existing) {
      existing.worker.concurrency = concurrency;
      return;
    }

    const queueName = `${region}-transaction`;
    const queue = new Queue<QueueEmailData>(queueName);
    const worker = new Worker<QueueEmailData>(
      queueName,
      createWorkerHandler(executeEmail),
      { concurrency },
    );
    worker.on("error", (error) => {
      logger.error({ err: error, region }, "Transactional email worker error");
    });
    emailQueueState.regions.set(region, { queue, worker });
  }

  private static async getQueue(region: string) {
    await this.init();
    const entry = emailQueueState.regions.get(region);
    if (!entry) {
      throw new Error(
        `Transactional email queue for region ${region} not found`,
      );
    }
    return entry.queue;
  }

  public static async queueEmail(
    emailId: string,
    teamId: number,
    region: string,
    delay?: number,
  ) {
    const queue = await this.getQueue(region);
    await queue.add(
      emailId,
      { emailId, timestamp: Date.now(), teamId },
      { jobId: emailId, delay },
    );
  }

  public static async queueBulk(
    jobs: Array<{
      emailId: string;
      teamId: number;
      region: string;
      delay?: number;
      timestamp?: number;
    }>,
  ): Promise<void> {
    const grouped = new Map<string, typeof jobs>();
    for (const job of jobs) {
      const group = grouped.get(job.region) ?? [];
      group.push(job);
      grouped.set(job.region, group);
    }
    await Promise.all(
      [...grouped].map(async ([region, group]) => {
        const queue = await this.getQueue(region);
        await queue.addBulk(
          group.map((job) => ({
            name: job.emailId,
            data: {
              emailId: job.emailId,
              timestamp: job.timestamp ?? Date.now(),
              teamId: job.teamId,
            },
            opts: { jobId: job.emailId, delay: job.delay },
          })),
        );
      }),
    );
  }

  public static async changeDelay(
    emailId: string,
    region: string,
    delay: number,
  ) {
    const queue = await this.getQueue(region);
    const job = await queue.getJob(emailId);
    if (!job) {
      throw new Error(`Job ${emailId} not found`);
    }
    await job.changeDelay(delay);
  }

  public static async chancelEmail(emailId: string, region: string) {
    const queue = await this.getQueue(region);
    const job = await queue.getJob(emailId);
    if (!job) {
      throw new Error(`Job ${emailId} not found`);
    }
    await job.remove();
  }

  public static init(): Promise<void> {
    if (!emailQueueState.initPromise) {
      emailQueueState.initPromise = (async () => {
        const settings = await db.sesSetting.findMany();
        for (const setting of settings) {
          this.initializeQueue(setting.region, setting.sesEmailRateLimit);
        }
      })().catch((error) => {
        emailQueueState.initPromise = undefined;
        throw error;
      });
    }
    return emailQueueState.initPromise;
  }
}

async function executeEmail(job: QueueEmailJob) {
  const email = await db.email.findUnique({
    where: { id: job.data.emailId },
  });
  if (!email) {
    logger.info({ emailId: job.data.emailId }, "Email not found, skipping");
    return;
  }

  const domain = email.domainId
    ? await db.domain.findUnique({ where: { id: email.domainId } })
    : null;
  const attachments: EmailAttachment[] = email.attachments
    ? JSON.parse(email.attachments)
    : [];
  const configurationSetName = await getConfigurationSetName(
    domain?.clickTracking ?? false,
    domain?.openTracking ?? false,
    domain?.region ?? env.AWS_DEFAULT_REGION,
  );
  if (!configurationSetName) {
    throw new Error("Email configuration set not found");
  }

  let inReplyToMessageId: string | undefined;
  if (email.inReplyToId) {
    const replyEmail = await db.email.findUnique({
      where: { id: email.inReplyToId },
    });
    inReplyToMessageId = replyEmail?.sesEmailId ?? undefined;
  }

  try {
    const limitCheck = await LimitService.checkEmailLimit(email.teamId);
    if (limitCheck.isLimitReached) {
      await db.emailEvent.create({
        data: {
          emailId: email.id,
          status: "FAILED",
          data: {
            error: "Email sending limit reached",
            reason: limitCheck.reason,
            limit: limitCheck.limit,
          },
          teamId: email.teamId,
        },
      });
      await db.email.update({
        where: { id: email.id },
        data: { latestStatus: "FAILED" },
      });
      return;
    }

    const messageId = await sendRawEmail({
      to: email.to,
      from: email.from,
      subject: email.subject,
      replyTo: email.replyTo ?? undefined,
      bcc: email.bcc,
      cc: email.cc,
      text: email.text ?? undefined,
      html: email.html ?? undefined,
      region: domain?.region ?? env.AWS_DEFAULT_REGION,
      configurationSetName,
      attachments: attachments.length > 0 ? attachments : undefined,
      inReplyToMessageId,
      emailId: email.id,
      sesTenantId: domain?.sesTenantId,
      headers: email.headers ? JSON.parse(email.headers) : undefined,
    });

    logger.info({ emailId: email.id, sesEmailId: messageId }, "Email sent");
    await db.email.update({
      where: { id: email.id },
      data: { sesEmailId: messageId, attachments: null, headers: null },
    });
  } catch (error) {
    logger.error({ err: error, emailId: email.id }, "Email delivery failed");
    await db.emailEvent.create({
      data: {
        emailId: email.id,
        status: "FAILED",
        data: { error: String(error) },
        teamId: email.teamId,
      },
    });
    await db.email.update({
      where: { id: email.id },
      data: { latestStatus: "FAILED" },
    });
    throw error;
  }
}
