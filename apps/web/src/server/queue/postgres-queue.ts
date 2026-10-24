import { createHash } from "crypto";
import { EventEmitter } from "events";
import { PgBoss, type Job, type JobResult, type QueueOptions } from "pg-boss";
import { env } from "~/env";
import { logger } from "../logger/log";

type WorkerRegistration = {
  concurrency: number;
  ready: Promise<void>;
};

type QueueState = {
  boss: PgBoss;
  startPromise?: Promise<PgBoss>;
  queuePromises: Map<string, Promise<void>>;
  workerRegistrations: Map<string, WorkerRegistration>;
};

function createQueueState(): QueueState {
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    max: 5,
    useListenNotify: true,
  });

  boss.on("error", (error) => {
    logger.error({ err: error }, "[PostgresQueue]: Queue error");
  });

  boss.on("warning", (warning) => {
    logger.warn({ warning }, "[PostgresQueue]: Queue warning");
  });

  return {
    boss,
    queuePromises: new Map(),
    workerRegistrations: new Map(),
  };
}

// Next.js can evaluate this module in both instrumentation and route bundles.
const globalForQueue = globalThis as typeof globalThis & {
  postgresQueueState?: QueueState;
};
const state = (globalForQueue.postgresQueueState ??= createQueueState());
const { boss, queuePromises, workerRegistrations } = state;

type LegacyJobOptions = {
  jobId?: string;
  delay?: number;
  attempts?: number;
  backoff?: { type?: string; delay?: number };
  singletonKey?: string;
  singletonSeconds?: number;
} & Record<string, unknown>;

type LegacyQueueOptions = Record<string, unknown> & {
  defaultJobOptions?: LegacyJobOptions;
};

function toQueueOptions(
  options?: LegacyQueueOptions,
): Omit<QueueOptions, "name"> {
  const defaultJobOptions = options?.defaultJobOptions;
  const attempts = defaultJobOptions?.attempts ?? 1;
  const retryDelay = Math.ceil((defaultJobOptions?.backoff?.delay ?? 0) / 1000);
  return {
    retryLimit: Math.max(0, attempts - 1),
    retryDelay,
    retryBackoff: defaultJobOptions?.backoff?.type === "exponential",
    retentionSeconds: 30 * 24 * 60 * 60,
    deleteAfterSeconds: 24 * 60 * 60,
  };
}

export function startPostgresQueue(): Promise<PgBoss> {
  if (!state.startPromise) {
    state.startPromise = boss.start().catch((error) => {
      state.startPromise = undefined;
      throw error;
    });
  }
  return state.startPromise;
}

async function ensureQueue(
  name: string,
  options: Omit<QueueOptions, "name"> = {},
): Promise<void> {
  await startPostgresQueue();

  const existing = queuePromises.get(name);
  if (existing) {
    await existing;
    return;
  }

  const creating = (async () => {
    await boss.createQueue(name, {
      retryLimit: 0,
      retentionSeconds: 30 * 24 * 60 * 60,
      ...options,
      notify: true,
    });
    // createQueue does not update queues that already exist.
    await boss.updateQueue(name, { notify: true });
  })();
  queuePromises.set(name, creating);
  try {
    await creating;
  } catch (error) {
    queuePromises.delete(name);
    throw error;
  }
}

function toJobId(id: string): string {
  const hex = createHash("sha256").update(id).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function sendQueueJob<T extends object>(
  name: string,
  data: T,
  options: {
    jobId?: string;
    delay?: number;
    singletonKey?: string;
    singletonSeconds?: number;
    queueOptions?: Omit<QueueOptions, "name">;
    attempts?: number;
    backoff?: { type?: string; delay?: number };
  } = {},
): Promise<string | null> {
  await ensureQueue(name, options.queueOptions);
  const attempts =
    options.attempts ??
    (options.queueOptions?.retryLimit !== undefined
      ? options.queueOptions.retryLimit + 1
      : 1);
  return boss.send(name, data, {
    retryLimit: Math.max(0, attempts - 1),
    ...(options.backoff
      ? {
          retryDelay: Math.ceil((options.backoff.delay ?? 0) / 1000),
          retryBackoff: options.backoff.type === "exponential",
        }
      : {}),
    ...(options.jobId ? { id: toJobId(options.jobId) } : {}),
    ...(options.delay
      ? { startAfter: new Date(Date.now() + options.delay) }
      : {}),
    ...(options.singletonKey ? { singletonKey: options.singletonKey } : {}),
    ...(options.singletonSeconds
      ? { singletonSeconds: options.singletonSeconds }
      : {}),
  });
}

export async function sendQueueJobs<T extends object>(
  name: string,
  jobs: Array<{
    data: T;
    jobId?: string;
    delay?: number;
    attempts?: number;
    backoff?: { type?: string; delay?: number };
    singletonKey?: string;
    singletonSeconds?: number;
  }>,
  queueOptions?: Omit<QueueOptions, "name">,
): Promise<(string | null)[]> {
  if (jobs.length === 0) {
    return [];
  }

  await ensureQueue(name, queueOptions);
  const ids = await boss.insert(
    name,
    jobs.map(
      ({
        data,
        jobId,
        delay,
        attempts,
        backoff,
        singletonKey,
        singletonSeconds,
      }) => ({
        data,
        ...(jobId ? { id: toJobId(jobId) } : {}),
        ...(delay ? { startAfter: new Date(Date.now() + delay) } : {}),
        retryLimit: Math.max(0, (attempts ?? 1) - 1),
        ...(singletonKey ? { singletonKey } : {}),
        ...(singletonSeconds ? { singletonSeconds } : {}),
        ...(backoff
          ? {
              retryDelay: Math.ceil((backoff.delay ?? 0) / 1000),
              retryBackoff: backoff.type === "exponential",
            }
          : {}),
      }),
    ),
    { returnId: true },
  );
  return ids ?? [];
}

export async function registerQueueWorker<T extends object>(
  name: string,
  handler: (job: Job<T>) => Promise<void>,
  options: {
    concurrency?: number;
    queueOptions?: Omit<QueueOptions, "name">;
    onCompleted?: (job: Job<T>) => void;
    onFailed?: (job: Job<T>, error: unknown) => void;
    onError?: (error: unknown) => void;
  } = {},
): Promise<void> {
  const concurrency = Math.max(1, options.concurrency ?? 1);
  await ensureQueue(name, options.queueOptions);

  const existing = workerRegistrations.get(name);
  if (existing?.concurrency === concurrency) {
    return existing.ready;
  }

  const ready = (async () => {
    if (existing) {
      await existing.ready;
      await boss.offWork(name, { wait: true });
    }

    await boss.work<T>(
      name,
      {
        batchSize: concurrency,
        localConcurrency: 1,
        pollingIntervalSeconds: 2,
        notifyPollingIntervalSeconds: 5,
        burstWhenBatchFull: true,
        perJobResults: true,
      },
      async (jobs): Promise<JobResult<unknown>[]> =>
        Promise.all(
          jobs.map(async (job): Promise<JobResult<unknown>> => {
            try {
              await handler(job);
              options.onCompleted?.(job);
              return { id: job.id, status: "completed" };
            } catch (error) {
              logger.error(
                { err: error, queue: name, jobId: job.id },
                "Job failed",
              );
              options.onFailed?.(job, error);
              return {
                id: job.id,
                status: "failed",
                output:
                  error instanceof Error
                    ? { message: error.message, stack: error.stack }
                    : { message: String(error) },
              };
            }
          }),
        ),
    );
  })().catch((error) => {
    if (workerRegistrations.get(name)?.ready === ready) {
      workerRegistrations.delete(name);
    }
    options.onError?.(error);
    throw error;
  });
  workerRegistrations.set(name, { concurrency, ready });
  await ready;
}

export async function scheduleQueue(
  name: string,
  cron: string,
  options: {
    key: string;
    timezone?: string;
    queueOptions?: Omit<QueueOptions, "name">;
  },
): Promise<void> {
  await ensureQueue(name, options.queueOptions);
  await boss.schedule(
    name,
    cron,
    {},
    {
      key: options.key,
      tz: options.timezone ?? "UTC",
      retryLimit: 0,
    },
  );
}

export async function getQueueCounts(name: string) {
  await ensureQueue(name);
  const queue = await boss.getQueue(name);
  if (!queue) {
    throw new Error(`PostgreSQL queue "${name}" was not found`);
  }
  return {
    waiting: queue.queuedCount,
    active: queue.activeCount,
    completed: Math.max(
      0,
      queue.totalCount -
        queue.queuedCount -
        queue.activeCount -
        queue.failedCount,
    ),
    failed: queue.failedCount,
  };
}

export class Queue<T extends object = Record<string, unknown>> {
  public readonly name: string;
  private readonly queueOptions: Omit<QueueOptions, "name">;
  private readonly defaultJobOptions: LegacyJobOptions;
  private readonly ready: Promise<void>;

  constructor(name: string, options: LegacyQueueOptions = {}) {
    this.name = name;
    this.defaultJobOptions = options.defaultJobOptions ?? {};
    this.queueOptions = toQueueOptions(options);
    this.ready = ensureQueue(name, this.queueOptions);
  }

  async add(_jobName: string, data: T, options: LegacyJobOptions = {}) {
    await this.ready;
    const mergedOptions = { ...this.defaultJobOptions, ...options };
    return sendQueueJob(this.name, data, {
      jobId: mergedOptions.jobId,
      delay: mergedOptions.delay,
      attempts: mergedOptions.attempts,
      backoff: mergedOptions.backoff,
      singletonKey: mergedOptions.singletonKey,
      singletonSeconds: mergedOptions.singletonSeconds,
      queueOptions: this.queueOptions,
    });
  }

  async addBulk(
    jobs: Array<{ name: string; data: T; opts?: LegacyJobOptions }>,
  ) {
    await this.ready;
    const batch = jobs.map(({ data, opts = {} }) => {
      const mergedOptions = { ...this.defaultJobOptions, ...opts };
      return {
        data,
        jobId: mergedOptions.jobId,
        delay: mergedOptions.delay,
        attempts: mergedOptions.attempts,
        backoff: mergedOptions.backoff,
        singletonKey: mergedOptions.singletonKey,
        singletonSeconds: mergedOptions.singletonSeconds,
      };
    });
    return sendQueueJobs(this.name, batch, this.queueOptions);
  }

  async getJob(id: string) {
    await this.ready;
    const job = await boss.getJobById<T>(this.name, toJobId(id));
    if (!job) {
      return null;
    }
    return {
      id,
      changeDelay: async (delay: number) => {
        const result = await boss.update(this.name, undefined, {
          id: job.id,
          startAfter: new Date(Date.now() + delay),
        });
        if (result.updated === 0) {
          throw new Error(`Unable to change delay for job ${id}`);
        }
      },
      remove: async () => {
        await boss.cancel(this.name, job.id);
      },
    };
  }

  async upsertJobScheduler(
    key: string,
    repeat: { pattern: string; tz?: string },
  ) {
    await scheduleQueue(this.name, repeat.pattern, {
      key,
      timezone: repeat.tz,
      queueOptions: this.queueOptions,
    });
  }
}

export class Worker<
  T extends object = Record<string, unknown>,
> extends EventEmitter {
  public readonly name: string;
  private readonly handler: (
    job: Job<T> & { attemptsMade: number },
  ) => Promise<void>;
  private readonly queueOptions: Omit<QueueOptions, "name">;
  private concurrencyValue: number;

  constructor(
    name: string,
    handler: (job: Job<T> & { attemptsMade: number }) => Promise<void>,
    options: { concurrency?: number } & LegacyQueueOptions = {},
  ) {
    super();
    this.name = name;
    this.handler = handler;
    this.concurrencyValue = options.concurrency ?? 1;
    this.queueOptions = toQueueOptions(options);
    void this.register();
  }

  get concurrency() {
    return this.concurrencyValue;
  }

  set concurrency(value: number) {
    this.concurrencyValue = Math.max(1, value);
    void this.register();
  }

  private async register() {
    try {
      await registerQueueWorker<T>(
        this.name,
        (job) =>
          this.handler(Object.assign(job, { attemptsMade: job.retryCount })),
        {
          concurrency: this.concurrencyValue,
          queueOptions: this.queueOptions,
          onCompleted: (job) => this.emit("completed", job),
          onFailed: (job, error) =>
            this.emit(
              "failed",
              Object.assign(job, { attemptsMade: job.retryCount }),
              error,
            ),
          onError: (error) => this.emit("error", error),
        },
      );
    } catch (error) {
      this.emit("error", error);
    }
  }
}

export async function stopPostgresQueue(): Promise<void> {
  if (state.startPromise) {
    await state.startPromise;
    await boss.stop();
    state.startPromise = undefined;
    queuePromises.clear();
    workerRegistrations.clear();
  }
}

export async function clearPostgresQueue(): Promise<void> {
  await startPostgresQueue();
  await boss.deleteAllJobs();
}
