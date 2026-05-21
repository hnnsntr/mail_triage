import { NextResponse } from "next/server";
import { getDefaultUser, prisma } from "@/lib/db/prisma";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function GET() {
  const user = await getDefaultUser();
  const today = startOfToday();

  const [unread, readToday, totalInbox, categoryGroup] = await Promise.all([
    prisma.email.count({
      where: {
        folder: "Inbox",
        isRead: false,
        account: { userId: user.id }
      }
    }),
    prisma.email.count({
      where: {
        folder: "Inbox",
        readAt: { gte: today },
        account: { userId: user.id }
      }
    }),
    prisma.email.count({
      where: {
        folder: "Inbox",
        account: { userId: user.id }
      }
    }),
    prisma.emailAnalysis.groupBy({
      by: ['category'],
      where: {
        email: {
          isRead: false,
          folder: "Inbox",
          account: { userId: user.id }
        }
      },
      _count: {
        emailId: true
      }
    })
  ]);

  const categoryCounts = categoryGroup.map(g => ({
    category: g.category,
    count: g._count.emailId
  }));

  return NextResponse.json({
    unread,
    readToday,
    totalInbox,
    categoryCounts,
    todayStartedAt: today.toISOString()
  });
}
