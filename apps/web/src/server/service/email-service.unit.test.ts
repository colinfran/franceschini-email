import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createEmail: vi.fn(),
  createEvent: vi.fn(),
  validateDomain: vi.fn(),
  suppressions: vi.fn(),
  queueEmail: vi.fn(),
  queueBulk: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {
    email: { create: mocks.createEmail },
    emailEvent: { create: mocks.createEvent },
  },
}));
vi.mock("./domain-service", () => ({
  validateDomainFromEmail: mocks.validateDomain,
  validateApiKeyDomainAccess: vi.fn(),
}));
vi.mock("./suppression-service", () => ({
  SuppressionService: { checkMultipleEmails: mocks.suppressions },
}));
vi.mock("./email-queue-service", () => ({
  EmailQueueService: {
    queueEmail: mocks.queueEmail,
    queueBulk: mocks.queueBulk,
  },
}));
vi.mock("~/server/logger/log", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { sendBulkEmails, sendEmail } from "./email-service";

const content = {
  teamId: 1,
  from: "sender@example.com",
  to: "recipient@example.com",
  subject: "Your order",
  html: "<p>Your order is ready.</p>",
  text: "Your order is ready.",
  attachments: [{ filename: "receipt.txt", content: "cmVjZWlwdA==" }],
  headers: { "X-Order-ID": "order-id" },
};

describe("direct transactional email content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateDomain.mockResolvedValue({ id: 2, region: "us-west-1" });
    mocks.suppressions.mockResolvedValue({});
    mocks.createEmail.mockImplementation(async ({ data }) => ({
      ...data,
      id: "email-id",
    }));
  });

  it("queues supplied content and inline attachments without templates or storage", async () => {
    const email = await sendEmail(content);

    expect(email.subject).toBe(content.subject);
    expect(email.html).toBe(content.html);
    expect(email.attachments).toBe(JSON.stringify(content.attachments));
    expect(email.headers).toBe(JSON.stringify(content.headers));
    expect(mocks.queueEmail).toHaveBeenCalledExactlyOnceWith(
      "email-id",
      1,
      "us-west-1",
      undefined,
    );
  });

  it("keeps scheduled batch content and attachments without template lookups", async () => {
    const scheduledAt = new Date(Date.now() + 60_000).toISOString();
    const emails = await sendBulkEmails([{ ...content, scheduledAt }]);

    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      subject: content.subject,
      html: content.html,
      attachments: JSON.stringify(content.attachments),
      headers: JSON.stringify(content.headers),
      latestStatus: "SCHEDULED",
      scheduledAt: new Date(scheduledAt),
    });
    expect(mocks.queueBulk).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({
        emailId: "email-id",
        region: "us-west-1",
        delay: expect.any(Number),
      }),
    ]);
  });

  it.each(["single", "batch"])(
    "records supplied content for a suppressed %s send without queuing it",
    async (mode) => {
      mocks.suppressions.mockResolvedValue({ [content.to]: true });
      const email =
        mode === "single"
          ? await sendEmail(content)
          : (await sendBulkEmails([content]))[0];

      expect(email).toMatchObject({
        subject: content.subject,
        html: content.html,
        latestStatus: "SUPPRESSED",
      });
      expect(mocks.createEvent).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: "SUPPRESSED" }),
      });
      expect(mocks.queueEmail).not.toHaveBeenCalled();
      expect(mocks.queueBulk).not.toHaveBeenCalled();
    },
  );
});
