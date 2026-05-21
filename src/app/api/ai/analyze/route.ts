import { NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultUser, prisma } from "@/lib/db/prisma";
import { analyzeEmail } from "@/lib/ai/analyze-email";
import { analyzeUnreadEmails } from "@/lib/jobs/analyze-unread";

const AnalyzeSchema = z.object({
  emailId: z.string().optional()
});

export async function POST(request: Request) {
  const user = await getDefaultUser();
  const body = AnalyzeSchema.parse(await request.json().catch(() => ({})));

  if (body.emailId) {
    await prisma.email.findFirstOrThrow({
      where: {
        id: body.emailId,
        account: { userId: user.id }
      }
    });

    const analysis = await analyzeEmail(body.emailId);
    return NextResponse.json(analysis);
  }

  const results = await analyzeUnreadEmails(user.id);
  return NextResponse.json({ analyzed: results.length });
}
