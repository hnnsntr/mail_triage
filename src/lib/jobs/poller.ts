import { getDefaultUser } from "@/lib/db/prisma";
import { analyzeUnreadEmails } from "./analyze-unread";
import { syncAllAccounts } from "./sync-mails";

const globalForPoller = globalThis as unknown as {
  aiMailingPoller?: NodeJS.Timeout;
};

export function startMailPolling() {
  if (globalForPoller.aiMailingPoller || process.env.MAIL_SYNC_AUTOSTART !== "true") {
    return;
  }

  const intervalMs = Math.max(Number(process.env.SYNC_INTERVAL_SECONDS ?? 180), 30) * 1000;

  globalForPoller.aiMailingPoller = setInterval(async () => {
    try {
      const user = await getDefaultUser();
      await syncAllAccounts(user.id);
      await analyzeUnreadEmails(user.id);
    } catch {
      // Avoid logging email content or provider details from background failures.
    }
  }, intervalMs);
}
