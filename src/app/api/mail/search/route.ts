import { NextResponse } from "next/server";
import { getDefaultUser, prisma } from "@/lib/db/prisma";
import { serializeEmail } from "@/lib/state/serializers";

export async function GET(request: Request) {
  const user = await getDefaultUser();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json([]);
  }

  const matches = await prisma.$queryRaw<{ id: string }[]>`
    SELECT e.id
    FROM "Email" e
    JOIN "MailAccount" a ON a.id = e."accountId"
    LEFT JOIN "EmailAnalysis" ea ON ea."emailId" = e.id
    WHERE a."userId" = ${user.id}
      AND to_tsvector(
        'simple',
        coalesce(e.subject, '') || ' ' ||
        coalesce(e."fromEmail", '') || ' ' ||
        coalesce(e.snippet, '') || ' ' ||
        coalesce(e."plainTextBody", '') || ' ' ||
        coalesce(ea.summary, '') || ' ' ||
        coalesce(ea.category, '')
      ) @@ plainto_tsquery('simple', ${query})
    ORDER BY e.date DESC
    LIMIT 50
  `;

  const ids = matches.map((match) => match.id);
  if (!ids.length) {
    return NextResponse.json([]);
  }

  const emails = await prisma.email.findMany({
    where: { id: { in: ids } },
    include: { analysis: true, todos: true }
  });

  const order = new Map(ids.map((id, index) => [id, index]));
  emails.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return NextResponse.json(emails.map(serializeEmail));
}
