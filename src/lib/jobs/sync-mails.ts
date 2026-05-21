import { prisma } from "@/lib/db/prisma";
import { fetchInboxMessages, fetchMessageFlags } from "@/lib/mail/imap";

export async function syncAccount(accountId: string) {
  const account = await prisma.mailAccount.findUniqueOrThrow({
    where: { id: accountId }
  });

  if (!account.isEnabled) {
    return { imported: 0, skipped: true };
  }

  const state = await prisma.syncState.upsert({
    where: {
      accountId_folder: {
        accountId,
        folder: "Inbox"
      }
    },
    create: {
      accountId,
      folder: "Inbox"
    },
    update: {}
  });

  try {
    const messages = await fetchInboxMessages(account, state.highestUid ?? undefined);
    let imported = 0;
    let highestUid = state.highestUid ?? BigInt(0);

    for (const message of messages) {
      if (message.imapUid && message.imapUid > highestUid) {
        highestUid = message.imapUid;
      }

      await prisma.email.upsert({
        where: {
          accountId_folder_externalMessageId: {
            accountId,
            folder: message.folder,
            externalMessageId: message.externalMessageId
          }
        },
        create: {
          accountId,
          externalMessageId: message.externalMessageId,
          imapUid: message.imapUid,
          threadId: message.threadId,
          folder: message.folder,
          subject: message.subject,
          fromName: message.fromName,
          fromEmail: message.fromEmail,
          to: message.to,
          cc: message.cc,
          date: message.date,
          isRead: message.isRead,
          hasAttachments: message.hasAttachments,
          attachmentMetadata: message.attachmentMetadata,
          plainTextBody: message.plainTextBody,
          htmlBody: message.htmlBody,
          snippet: message.snippet
        },
        update: {
          isRead: message.isRead,
          imapUid: message.imapUid,
          subject: message.subject,
          fromName: message.fromName,
          fromEmail: message.fromEmail,
          to: message.to,
          cc: message.cc,
          date: message.date,
          hasAttachments: message.hasAttachments,
          attachmentMetadata: message.attachmentMetadata,
          snippet: message.snippet
        }
      });

      imported += 1;
    }

    // Check existing unread messages to see if they are now read
    const unreadEmails = await prisma.email.findMany({
      where: {
        accountId,
        folder: "Inbox",
        isRead: false,
        imapUid: { not: null }
      },
      select: { id: true, imapUid: true }
    });

    if (unreadEmails.length > 0) {
      const uids = unreadEmails.map(e => e.imapUid!);
      const flagMap = await fetchMessageFlags(account, "Inbox", uids);
      
      for (const email of unreadEmails) {
        const flags = flagMap.get(email.imapUid!);
        if (flags && flags.has("\\Seen")) {
          await prisma.email.update({
            where: { id: email.id },
            data: { isRead: true }
          });
        }
      }
    }

    await prisma.$transaction([
      prisma.syncState.update({
        where: { id: state.id },
        data: {
          highestUid: highestUid > BigInt(0) ? highestUid : state.highestUid,
          lastSeenUid: highestUid > BigInt(0) ? highestUid : state.lastSeenUid
        }
      }),
      prisma.mailAccount.update({
        where: { id: accountId },
        data: {
          lastSyncAt: new Date(),
          lastSyncError: null
        }
      })
    ]);

    return { imported, skipped: false };
  } catch (error) {
    await prisma.mailAccount.update({
      where: { id: accountId },
      data: {
        lastSyncError: error instanceof Error ? error.message : "Sync failed"
      }
    });

    throw error;
  }
}

export async function syncAllAccounts(userId: string) {
  const accounts = await prisma.mailAccount.findMany({
    where: { userId, isEnabled: true }
  });

  const results = [];

  for (const account of accounts) {
    results.push({
      accountId: account.id,
      ...(await syncAccount(account.id))
    });
  }

  return results;
}
