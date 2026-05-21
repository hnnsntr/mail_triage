import { NextResponse } from "next/server";
import { getDefaultUser, prisma } from "@/lib/db/prisma";
import { serializeEmail } from "@/lib/state/serializers";

export async function GET(request: Request) {
  const user = await getDefaultUser();
  const { searchParams } = new URL(request.url);
  const folder = searchParams.get("folder") ?? "Inbox";
  const category = searchParams.get("category");
  const categories = searchParams.get("categories")?.split(",").filter(Boolean) ?? [];
  const excludeCategories = searchParams.get("excludeCategories")?.split(",").filter(Boolean) ?? [];
  const status = searchParams.get("status");
  const take = Math.min(Number(searchParams.get("take") ?? 50), 100);

  const emails = await prisma.email.findMany({
    where: {
      account: { userId: user.id },
      folder,
      ...(status === "unread" ? { isRead: false } : {}),
      ...(status === "read" ? { isRead: true } : {}),
      ...(category ? { analysis: { category } } : {}),
      ...(categories.length ? { analysis: { category: { in: categories } } } : {}),
      ...(excludeCategories.length
        ? {
            OR: [
              { analysis: null },
              {
                analysis: {
                  category: {
                    notIn: excludeCategories
                  }
                }
              }
            ]
          }
        : {})
    },
    include: {
      analysis: true,
      todos: true
    },
    orderBy: [{ isRead: "asc" }, { date: "desc" }],
    take
  });

  return NextResponse.json(emails.map(serializeEmail));
}
