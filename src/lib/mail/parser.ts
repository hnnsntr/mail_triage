import { simpleParser } from "mailparser";
import type { AddressObject } from "mailparser";
import crypto from "node:crypto";
import type { AttachmentMetadata, ParsedMailMessage } from "./types";

const REPLY_MARKERS = [
  /^On .+ wrote:$/im,
  /^From:\s.+$/im,
  /^-----Original Message-----$/im
];

function addresses(addressObject?: AddressObject | AddressObject[]): string[] {
  const objects = Array.isArray(addressObject) ? addressObject : addressObject ? [addressObject] : [];
  return objects.flatMap((object) => object.value.map((address) => address.address).filter(Boolean)) as string[];
}

function cleanEmailBody(body: string): string {
  let cleaned = body.replace(/\r\n/g, "\n");

  for (const marker of REPLY_MARKERS) {
    const match = cleaned.match(marker);
    if (match?.index && match.index > 0) {
      cleaned = cleaned.slice(0, match.index);
    }
  }

  cleaned = cleaned
    .replace(/\n--\s*\n[\s\S]*$/m, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned.slice(0, 24000);
}

export function makeSnippet(body: string, subject: string): string {
  const source = body || subject;
  return source.replace(/\s+/g, " ").trim().slice(0, 240);
}

export async function parseRawEmail(input: {
  source: Buffer;
  uid?: bigint;
  flags: Set<string>;
  folder: string;
}): Promise<ParsedMailMessage> {
  const parsed = await simpleParser(input.source, {
    skipImageLinks: true,
    skipTextToHtml: true
  });

  const from = parsed.from?.value.at(0);
  const plainTextBody = cleanEmailBody(parsed.text ?? "");
  const attachmentMetadata: AttachmentMetadata[] = parsed.attachments.map((attachment) => ({
    filename: attachment.filename ?? "attachment",
    mimeType: attachment.contentType,
    size: attachment.size
  }));

  return {
    externalMessageId:
      parsed.messageId ??
      `${input.folder}:${input.uid?.toString() ?? parsed.date?.getTime() ?? crypto.randomUUID()}`,
    imapUid: input.uid,
    threadId: parsed.inReplyTo ?? parsed.references?.at(0),
    folder: input.folder,
    subject: parsed.subject ?? "(No subject)",
    fromName: from?.name,
    fromEmail: from?.address ?? "unknown@example.com",
    to: addresses(parsed.to as AddressObject | undefined),
    cc: addresses(parsed.cc as AddressObject | undefined),
    date: parsed.date ?? new Date(),
    isRead: input.flags.has("\\Seen"),
    hasAttachments: attachmentMetadata.length > 0,
    attachmentMetadata,
    plainTextBody,
    htmlBody: typeof parsed.html === "string" ? parsed.html : undefined,
    snippet: makeSnippet(plainTextBody, parsed.subject ?? "")
  };
}

export function cleanBodyForAi(body: string): string {
  return cleanEmailBody(body).slice(0, 12000);
}

export async function extractAttachmentFromRawEmail(source: Buffer, index: number) {
  const parsed = await simpleParser(source, {
    skipImageLinks: true,
    skipTextToHtml: true
  });
  const attachment = parsed.attachments[index];

  if (!attachment) {
    return null;
  }

  return {
    filename: attachment.filename ?? `attachment-${index + 1}`,
    mimeType: attachment.contentType || "application/octet-stream",
    size: attachment.size,
    content: attachment.content
  };
}
