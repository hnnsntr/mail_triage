import { NextResponse } from "next/server";
import { getDefaultUser, prisma } from "@/lib/db/prisma";
import { fetchRawMessageByUid } from "@/lib/mail/imap";
import { extractAttachmentFromRawEmail } from "@/lib/mail/parser";

function contentDisposition(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index } = await params;
  const user = await getDefaultUser();
  const attachmentIndex = Number(index);

  if (!Number.isInteger(attachmentIndex) || attachmentIndex < 0) {
    return NextResponse.json({ error: "Ungueltiger Anhang." }, { status: 400 });
  }

  const email = await prisma.email.findFirstOrThrow({
    where: {
      id,
      account: { userId: user.id }
    },
    include: { account: true }
  });

  if (!email.imapUid) {
    return NextResponse.json({ error: "Diese Mail hat keine IMAP UID. Bitte erneut abrufen." }, { status: 404 });
  }

  const raw = await fetchRawMessageByUid(email.account, email.folder, email.imapUid);
  if (!raw) {
    return NextResponse.json({ error: "Mail konnte auf dem Server nicht gefunden werden." }, { status: 404 });
  }

  const attachment = await extractAttachmentFromRawEmail(raw, attachmentIndex);
  if (!attachment) {
    return NextResponse.json({ error: "Anhang konnte nicht gefunden werden." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(attachment.content), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(attachment.size),
      "Content-Disposition": contentDisposition(attachment.filename),
      "Cache-Control": "private, max-age=0, must-revalidate"
    }
  });
}
