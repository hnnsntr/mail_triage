import { ImapFlow } from "imapflow";
import type { MailAccount } from "@prisma/client";
import { decryptSecret } from "@/lib/security/encryption";
import { parseRawEmail } from "./parser";
import type { ParsedMailMessage } from "./types";

export const DEFAULT_FOLDERS = ["Inbox", "Sent", "Archive", "Trash", "Spam", "Important"] as const;

type ImapConnectionSettings = {
  host: string;
  port: number;
  security: string;
  username: string;
  password: string;
};

function secureMode(security: string) {
  return security === "ssl" || security === "tls";
}

function startTlsMode(security: string) {
  return security === "starttls";
}

function createImapClientFromSettings(settings: ImapConnectionSettings) {
  return new ImapFlow({
    host: settings.host,
    port: settings.port,
    secure: secureMode(settings.security),
    doSTARTTLS: startTlsMode(settings.security),
    auth: {
      user: settings.username,
      pass: settings.password
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    logger: false
  });
}

export function createImapClient(account: MailAccount) {
  return createImapClientFromSettings({
    host: account.imapHost,
    port: account.imapPort,
    security: account.imapSecurity,
    username: account.imapUsername,
    password: decryptSecret(account.imapPasswordEncrypted)
  });
}

export async function validateImapConnection(settings: ImapConnectionSettings) {
  const client = createImapClientFromSettings(settings);

  try {
    await client.connect();
  } finally {
    if (client.usable) {
      await client.logout().catch(() => undefined);
    }
  }
}

export async function fetchInboxMessages(account: MailAccount, sinceUid?: bigint) {
  const client = createImapClient(account);
  const folder = "Inbox";
  const messages: ParsedMailMessage[] = [];
  const initialLimit = Math.max(Number(process.env.INITIAL_SYNC_LIMIT ?? 50), 1);

  await client.connect();

  try {
    const lock = await client.getMailboxLock(folder);
    try {
      const uidNext = client.mailbox && typeof client.mailbox.uidNext === "number" ? client.mailbox.uidNext : undefined;
      const firstUid = uidNext ? Math.max(1, uidNext - initialLimit) : 1;
      const query = sinceUid ? `${sinceUid + BigInt(1)}:*` : `${firstUid}:*`;

      // Fetching source through IMAPFlow uses PEEK semantics and does not set \Seen.
      for await (const message of client.fetch(
        query,
        { uid: true, flags: true, envelope: true, source: true },
        { uid: true }
      )) {
        if (!message.source) {
          continue;
        }

        messages.push(
          await parseRawEmail({
            source: Buffer.from(message.source),
            uid: message.uid ? BigInt(message.uid) : undefined,
            flags: new Set(Array.from(message.flags ?? [])),
            folder
          })
        );
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return messages;
}

export async function fetchRawMessageByUid(account: MailAccount, folder: string, uid: bigint) {
  const client = createImapClient(account);

  await client.connect();

  try {
    const lock = await client.getMailboxLock(folder);
    try {
      // source fetch is non-mutating and does not set \Seen.
      const message = await client.fetchOne(uid.toString(), { source: true }, { uid: true });
      if (!message || !message.source) {
        return null;
      }
      return Buffer.from(message.source);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function setRemoteReadState(account: MailAccount, uid: bigint, read: boolean) {
  const client = createImapClient(account);
  await client.connect();

  try {
    const lock = await client.getMailboxLock("Inbox");
    try {
      if (read) {
        await client.messageFlagsAdd(uid.toString(), ["\\Seen"], { uid: true });
      } else {
        await client.messageFlagsRemove(uid.toString(), ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function fetchMessageFlags(account: MailAccount, folder: string, uids: bigint[]): Promise<Map<bigint, Set<string>>> {
  const flagMap = new Map<bigint, Set<string>>();
  if (uids.length === 0) return flagMap;
  
  const client = createImapClient(account);
  await client.connect();

  try {
    const lock = await client.getMailboxLock(folder);
    try {
      const chunkSize = 100;
      for (let i = 0; i < uids.length; i += chunkSize) {
        const chunk = uids.slice(i, i + chunkSize);
        const uidString = chunk.map(u => u.toString()).join(",");
        for await (const message of client.fetch(uidString, { flags: true }, { uid: true })) {
          if (message.uid) {
            flagMap.set(BigInt(message.uid), new Set(Array.from(message.flags ?? [])));
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
  return flagMap;
}
