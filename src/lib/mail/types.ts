export type MailSecurity = "ssl" | "starttls" | "none";

export type AttachmentMetadata = {
  filename: string;
  mimeType: string;
  size: number;
};

export type ParsedMailMessage = {
  externalMessageId: string;
  imapUid?: bigint;
  threadId?: string;
  folder: string;
  subject: string;
  fromName?: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  date: Date;
  isRead: boolean;
  hasAttachments: boolean;
  attachmentMetadata: AttachmentMetadata[];
  plainTextBody: string;
  htmlBody?: string;
  snippet: string;
};
