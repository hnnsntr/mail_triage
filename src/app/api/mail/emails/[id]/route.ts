import { NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultUser, prisma } from "@/lib/db/prisma";
import { setRemoteReadState } from "@/lib/mail/imap";
import { serializeEmail } from "@/lib/state/serializers";

const PatchEmailSchema = z.object({
  action: z.enum(["mark_read", "mark_unread", "archive", "ignore_suggestion"])
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getDefaultUser();

  const email = await prisma.email.findFirstOrThrow({
    where: {
      id,
      account: { userId: user.id }
    },
    include: { analysis: true, todos: true }
  });

  return NextResponse.json(serializeEmail(email));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getDefaultUser();
  const { action } = PatchEmailSchema.parse(await request.json());

  const email = await prisma.email.findFirstOrThrow({
    where: {
      id,
      account: { userId: user.id }
    },
    include: { account: true }
  });

  if (action === "mark_read" || action === "mark_unread") {
    const nextReadState = action === "mark_read";

    if (email.imapUid) {
      await setRemoteReadState(email.account, email.imapUid, nextReadState);
    }

    const updated = await prisma.email.update({
      where: { id },
      data: {
        isRead: nextReadState,
        readAt: nextReadState ? new Date() : null
      },
      include: { analysis: true, todos: true }
    });

    return NextResponse.json(serializeEmail(updated));
  }

  if (action === "ignore_suggestion") {
    await prisma.emailAnalysis.updateMany({
      where: {
        emailId: id,
        email: { account: { userId: user.id } }
      },
      data: {
        todoShouldCreate: false,
        todoTitle: null,
        todoDueDate: null,
        todoReason: null
      }
    });

    const updated = await prisma.email.findUniqueOrThrow({
      where: { id },
      include: { analysis: true, todos: true }
    });

    return NextResponse.json(serializeEmail(updated));
  }

  const archived = await prisma.email.update({
    where: { id },
    data: { folder: "Archive" },
    include: { analysis: true, todos: true }
  });

  return NextResponse.json(serializeEmail(archived));
}
