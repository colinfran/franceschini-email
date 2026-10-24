export type EmailContent = {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<EmailAttachment>;
  headers?: Record<string, string>;
  scheduledAt?: string;
  inReplyToId?: string | null;
  sesTenantId?: string | null;
};

export type EmailAttachment = {
  filename: string;
  content: string;
};
