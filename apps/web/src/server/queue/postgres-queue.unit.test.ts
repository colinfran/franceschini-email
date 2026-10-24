import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Job, type JobResult, type WorkOptions } from "pg-boss";

type BatchHandler = (jobs: Job<object>[]) => Promise<JobResult<unknown>[]>;

const { mockBoss, mockLogger } = vi.hoisted(() => ({
  mockBoss: {
    on: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    createQueue: vi.fn(),
    updateQueue: vi.fn(),
    work: vi.fn<
      (
        name: string,
        options: WorkOptions,
        handler: BatchHandler,
      ) => Promise<string>
    >(),
    offWork: vi.fn(),
    send: vi.fn(),
    insert: vi.fn(),
  },
  mockLogger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("pg-boss", () => ({
  PgBoss: vi.fn().mockImplementation(() => mockBoss),
}));
vi.mock("~/server/logger/log", () => ({ logger: mockLogger }));

import {
  registerQueueWorker,
  sendQueueJob,
  sendQueueJobs,
  startPostgresQueue,
  stopPostgresQueue,
} from "./postgres-queue";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function job(id: string): Job<object> {
  return {
    id,
    name: "test-queue",
    data: {},
    expireInSeconds: 900,
    heartbeatSeconds: null,
    retryCount: 0,
    signal: new AbortController().signal,
  };
}

describe("PostgreSQL queue runtime", () => {
  beforeEach(() => {
    mockBoss.start.mockResolvedValue(mockBoss);
    mockBoss.work.mockResolvedValue("worker-id");
    mockBoss.send.mockResolvedValue("job-id");
  });

  afterEach(async () => {
    await stopPostgresQueue();
  });

  it("shares its runtime globally and starts only once for concurrent callers", async () => {
    expect(globalThis).toHaveProperty("postgresQueueState.boss", mockBoss);
    const first = startPostgresQueue();
    const second = startPostgresQueue();

    expect(first).toBe(second);
    await Promise.all([first, second]);
    expect(mockBoss.start).toHaveBeenCalledTimes(1);
  });

  it("retries a failed startup", async () => {
    mockBoss.start.mockRejectedValueOnce(new Error("offline"));
    await expect(startPostgresQueue()).rejects.toThrow("offline");
    await startPostgresQueue();
    expect(mockBoss.start).toHaveBeenCalledTimes(2);
  });

  it("enables notifications for new and existing queues only once", async () => {
    await Promise.all([
      sendQueueJob("test-queue", {}),
      sendQueueJob("test-queue", {}),
    ]);

    expect(mockBoss.createQueue).toHaveBeenCalledTimes(1);
    expect(mockBoss.createQueue).toHaveBeenCalledWith(
      "test-queue",
      expect.objectContaining({ notify: true }),
    );
    expect(mockBoss.updateQueue).toHaveBeenCalledExactlyOnceWith("test-queue", {
      notify: true,
    });
  });

  it("retries failed queue setup instead of caching a rejected promise", async () => {
    mockBoss.updateQueue.mockRejectedValueOnce(new Error("offline"));
    await expect(sendQueueJob("test-queue", {})).rejects.toThrow("offline");
    await sendQueueJob("test-queue", {});
    expect(mockBoss.createQueue).toHaveBeenCalledTimes(2);
  });

  it("deduplicates registrations while the first worker is still starting", async () => {
    const pending = deferred<string>();
    mockBoss.work.mockReturnValueOnce(pending.promise);

    const first = registerQueueWorker("test-queue", vi.fn(), {
      concurrency: 50,
    });
    const second = registerQueueWorker("test-queue", vi.fn(), {
      concurrency: 50,
    });
    await vi.waitFor(() => expect(mockBoss.work).toHaveBeenCalledTimes(1));
    pending.resolve("worker-id");
    await Promise.all([first, second]);
    expect(mockBoss.work).toHaveBeenCalledTimes(1);
  });

  it("uses one idle poller while retaining the requested processing concurrency", async () => {
    const pending = deferred<void>();
    const handler = vi.fn(() => pending.promise);
    await registerQueueWorker("test-queue", handler, { concurrency: 50 });

    const registration = mockBoss.work.mock.calls[0]!;
    expect(registration[1]).toEqual({
      batchSize: 50,
      localConcurrency: 1,
      pollingIntervalSeconds: 2,
      notifyPollingIntervalSeconds: 5,
      burstWhenBatchFull: true,
      perJobResults: true,
    });

    const jobs = Array.from({ length: 50 }, (_, index) => job(String(index)));
    const processing = registration[2](jobs);
    expect(handler).toHaveBeenCalledTimes(50);
    pending.resolve();
    await expect(processing).resolves.toEqual(
      jobs.map(({ id }) => ({ id, status: "completed" })),
    );
  });

  it("settles failures independently so successful jobs are not retried", async () => {
    const failure = new Error("send failed");
    const handler = vi.fn(async (current: Job<object>) => {
      if (current.id === "bad") throw failure;
    });
    const onCompleted = vi.fn();
    const onFailed = vi.fn();
    await registerQueueWorker("test-queue", handler, {
      concurrency: 2,
      onCompleted,
      onFailed,
    });

    const good = job("good");
    const bad = job("bad");
    const results = await mockBoss.work.mock.calls[0]![2]([good, bad]);
    expect(results).toEqual([
      { id: "good", status: "completed" },
      {
        id: "bad",
        status: "failed",
        output: { message: "send failed", stack: failure.stack },
      },
    ]);
    expect(onCompleted).toHaveBeenCalledExactlyOnceWith(good);
    expect(onFailed).toHaveBeenCalledExactlyOnceWith(bad, failure);
    expect(mockLogger.error).toHaveBeenCalledWith(
      { err: failure, queue: "test-queue", jobId: "bad" },
      "Job failed",
    );
  });

  it("waits for an old registration before changing concurrency", async () => {
    const pending = deferred<string>();
    mockBoss.work.mockReturnValueOnce(pending.promise);
    const first = registerQueueWorker("test-queue", vi.fn(), {
      concurrency: 2,
    });
    const second = registerQueueWorker("test-queue", vi.fn(), {
      concurrency: 5,
    });

    await vi.waitFor(() => expect(mockBoss.work).toHaveBeenCalledTimes(1));
    expect(mockBoss.offWork).not.toHaveBeenCalled();
    pending.resolve("worker-id");
    await Promise.all([first, second]);

    expect(mockBoss.offWork).toHaveBeenCalledExactlyOnceWith("test-queue", {
      wait: true,
    });
    expect(mockBoss.work).toHaveBeenLastCalledWith(
      "test-queue",
      expect.objectContaining({ batchSize: 5, localConcurrency: 1 }),
      expect.any(Function),
    );
  });

  it("allows registration to be retried after a failure", async () => {
    const onError = vi.fn();
    mockBoss.work.mockRejectedValueOnce(new Error("worker failed"));
    await expect(
      registerQueueWorker("test-queue", vi.fn(), { onError }),
    ).rejects.toThrow("worker failed");
    await registerQueueWorker("test-queue", vi.fn());
    expect(mockBoss.work).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("preserves delay, singleton, and retry options for individual jobs", async () => {
    const before = Date.now();
    await sendQueueJob(
      "test-queue",
      {},
      {
        delay: 10_000,
        singletonKey: "singleton",
        singletonSeconds: 5,
        attempts: 3,
        backoff: { type: "exponential", delay: 1500 },
      },
    );
    const options = mockBoss.send.mock.calls[0]![2];
    expect(options).toMatchObject({
      retryLimit: 2,
      retryDelay: 2,
      retryBackoff: true,
      singletonKey: "singleton",
      singletonSeconds: 5,
    });
    expect(options.startAfter.getTime()).toBeGreaterThanOrEqual(
      before + 10_000,
    );
  });

  it("preserves job IDs and retry options for bulk insertion", async () => {
    mockBoss.insert.mockResolvedValueOnce(["job-id"]);
    await sendQueueJobs("test-queue", [
      {
        data: {},
        jobId: "stable-id",
        attempts: 2,
        backoff: { delay: 2000 },
      },
    ]);
    expect(mockBoss.insert).toHaveBeenCalledWith(
      "test-queue",
      [
        expect.objectContaining({
          id: expect.any(String),
          retryLimit: 1,
          retryDelay: 2,
        }),
      ],
      { returnId: true },
    );
  });
});
