import { prisma } from "@/lib/db/prisma";
import { analyzeEmail } from "@/lib/ai/analyze-email";

export async function analyzeUnreadEmails(userId: string, limit = 25) {
  const emails = await prisma.email.findMany({
    where: {
      isRead: false,
      account: { userId },
      analysis: null
    },
    orderBy: [{ date: "desc" }],
    take: limit
  });

  const results = [];

  for (const email of emails) {
    results.push(await analyzeEmail(email.id));
  }

  return results;
}
