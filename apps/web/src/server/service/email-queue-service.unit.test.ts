import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Job } from "pg-boss";

type EmailJobData = { emailId: string; timestamp: number; teamId?: number };
type EmailHandler = (
  job: Job<EmailJobData> & { attemptsMade: number },
) => Promise<void>;

const mocks = vi.hoisted(() => ({
  settings: vi.fn(),
  findEmail: vi.fn(),
  findDomain: vi.fn(),
  updateEmail: vi.fn(),
  createEvent: vi.fn(),
  send: vi.fn(),
  limits: vi.fn(),
  configuration: vi.fn(),
  add: vi.fn(),
  addBulk: vi.fn(),
  getJob: vi.fn(),
  queues: [] as string[],
  workers: [] as Array<{
    name: string;
    handler: EmailHandler;
    concurrency: number;
  }>,
}));

vi.mock("~/server/queue/postgres-queue", () => ({
  Queue: class {
    add = mocks.add;
    addBulk = mocks.addBulk;
    getJob = mocks.getJob;
    constructor(public name: string) {
      mocks.queues.push(name);
    }
  },
  Worker: class {
    on = vi.fn();
    concurrency: number;
    constructor(
      public name: string,
      public handler: EmailHandler,
      options: { concurrency: number },
    ) {
      this.concurrency = options.concurrency;
      mocks.workers.push(this);
    }
  },
}));
vi.mock("~/server/queue/job-context", () => ({
  createWorkerHandler: (handler: EmailHandler) => handler,
}));
vi.mock("~/server/db", () => ({
  db: {
    sesSetting: { findMany: mocks.settings },
    email: { findUnique: mocks.findEmail, update: mocks.updateEmail },
    domain: { findUnique: mocks.findDomain },
    emailEvent: { create: mocks.createEvent },
  },
}));
vi.mock("~/utils/ses-utils", () => ({
  getConfigurationSetName: mocks.configuration,
}));
vi.mock("~/server/aws/ses", () => ({ sendRawEmail: mocks.send }));
vi.mock("~/server/service/limit-service", () => ({
  LimitService: { checkEmailLimit: mocks.limits },
}));
vi.mock("~/server/logger/log", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { EmailQueueService } from "./email-queue-service";

const state = (
  globalThis as typeof globalThis & {
    transactionalEmailQueueState: {
      initPromise?: Promise<void>;
      regions: Map<string, unknown>;
    };
  }
).transactionalEmailQueueState;

const email = {
  id: "email-id",
  teamId: 1,
  domainId: 2,
  to: ["recipient@example.com"],
  from: "sender@example.com",
  subject: "Hello",
  text: "Hello",
  html: "<p>Hello</p>",
  replyTo: [],
  cc: [],
  bcc: [],
  attachments: JSON.stringify([
    { filename: "report.txt", content: "aGVsbG8=" },
  ]),
  headers: JSON.stringify({ "X-Request-ID": "request-id" }),
  inReplyToId: null,
};

describe("transactional email queues", () => {
  beforeEach(() => {
    mocks.queues.length = 0;
    mocks.workers.length = 0;
    mocks.settings.mockResolvedValue([
      { region: "us-west-1", sesEmailRateLimit: 10, transactionalQuota: 50 },
    ]);
    mocks.findEmail.mockResolvedValue(email);
    mocks.findDomain.mockResolvedValue({
      region: "us-west-1",
      sesTenantId: "tenant-id",
    });
    mocks.configuration.mockResolvedValue("configuration");
    mocks.limits.mockResolvedValue({ isLimitReached: false });
    mocks.send.mockResolvedValue("ses-id");
  });

  afterEach(() => {
    state.initPromise = undefined;
    state.regions.clear();
  });

  function job(): Job<EmailJobData> & { attemptsMade: number } {
    return {
      id: "job-id",
      name: "us-west-1-transaction",
      data: { emailId: "email-id", timestamp: Date.now(), teamId: 1 },
      expireInSeconds: 900,
      heartbeatSeconds: null,
      retryCount: 0,
      attemptsMade: 0,
      signal: new AbortController().signal,
    };
  }

  it("initializes once and uses the full send rate without a marketing worker", async () => {
    await Promise.all([EmailQueueService.init(), EmailQueueService.init()]);
    expect(mocks.settings).toHaveBeenCalledTimes(1);
    expect(mocks.queues).toEqual(["us-west-1-transaction"]);
    expect(mocks.workers).toHaveLength(1);
    expect(mocks.workers[0]?.concurrency).toBe(10);
  });

  it("updates concurrency without creating another regional worker", async () => {
    await EmailQueueService.init();
    EmailQueueService.initializeQueue("us-west-1", 20);
    expect(mocks.workers).toHaveLength(1);
    expect(mocks.workers[0]?.concurrency).toBe(20);
  });

  it("keeps single-job IDs and scheduled delays", async () => {
    await EmailQueueService.queueEmail("email-id", 1, "us-west-1", 10_000);
    expect(mocks.add).toHaveBeenCalledExactlyOnceWith(
      "email-id",
      {
        emailId: "email-id",
        teamId: 1,
        timestamp: expect.any(Number),
      },
      { jobId: "email-id", delay: 10_000 },
    );
  });

  it("keeps transactional batch sending and reports queue failures", async () => {
    const jobs = [
      { emailId: "email-id", teamId: 1, region: "us-west-1", delay: 5000 },
    ];
    await EmailQueueService.queueBulk(jobs);
    expect(mocks.addBulk).toHaveBeenCalledWith([
      {
        name: "email-id",
        data: { emailId: "email-id", teamId: 1, timestamp: expect.any(Number) },
        opts: { jobId: "email-id", delay: 5000 },
      },
    ]);
    mocks.addBulk.mockRejectedValueOnce(new Error("database offline"));
    await expect(EmailQueueService.queueBulk(jobs)).rejects.toThrow(
      "database offline",
    );
  });

  it("can reschedule and cancel queued transactional email", async () => {
    const changeDelay = vi.fn();
    const remove = vi.fn();
    mocks.getJob.mockResolvedValue({ changeDelay, remove });
    await EmailQueueService.changeDelay("email-id", "us-west-1", 5000);
    await EmailQueueService.chancelEmail("email-id", "us-west-1");
    expect(changeDelay).toHaveBeenCalledExactlyOnceWith(5000);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("preserves headers, attachments, tenant, and message content when sending", async () => {
    await EmailQueueService.init();
    await mocks.workers[0]!.handler(job());
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Hello",
        text: "Hello",
        html: "<p>Hello</p>",
        headers: { "X-Request-ID": "request-id" },
        attachments: [{ filename: "report.txt", content: "aGVsbG8=" }],
        sesTenantId: "tenant-id",
      }),
    );
    expect(mocks.updateEmail).toHaveBeenCalledWith({
      where: { id: "email-id" },
      data: { sesEmailId: "ses-id", attachments: null, headers: null },
    });
  });

  it("retains sending-limit protection", async () => {
    mocks.limits.mockResolvedValue({ isLimitReached: true, limit: 100 });
    await EmailQueueService.init();
    await mocks.workers[0]!.handler(job());
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.updateEmail).toHaveBeenCalledWith({
      where: { id: "email-id" },
      data: { latestStatus: "FAILED" },
    });
  });

  it("marks delivery failures and lets the queue record the failed outcome", async () => {
    mocks.send.mockRejectedValueOnce(new Error("SES unavailable"));
    await EmailQueueService.init();
    await expect(mocks.workers[0]!.handler(job())).rejects.toThrow(
      "SES unavailable",
    );
    expect(mocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          emailId: "email-id",
        }),
      }),
    );
  });
});
