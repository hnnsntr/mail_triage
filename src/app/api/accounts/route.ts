import { NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultUser, prisma } from "@/lib/db/prisma";
import { validateImapConnection } from "@/lib/mail/imap";
import { validateSmtpConnection } from "@/lib/mail/smtp";
import { encryptSecret } from "@/lib/security/encryption";
import { serializeAccount } from "@/lib/state/serializers";

const AccountSchema = z.object({
  displayName: z.string().min(1),
  emailAddress: z.string().email(),
  imapHost: z.string().min(1),
  imapPort: z.coerce.number().int().positive(),
  imapSecurity: z.enum(["ssl", "starttls", "none"]),
  imapUsername: z.string().min(1),
  imapPassword: z.string().min(1),
  smtpHost: z.string().optional().nullable(),
  smtpPort: z.coerce.number().int().positive().optional().nullable(),
  smtpSecurity: z.enum(["ssl", "starttls", "none"]).optional().nullable(),
  smtpUsername: z.string().optional().nullable(),
  smtpPassword: z.string().optional().nullable()
}).superRefine((value, ctx) => {
  const hasAnySmtp = Boolean(value.smtpHost || value.smtpUsername || value.smtpPassword);
  if (!hasAnySmtp) return;

  for (const field of ["smtpHost", "smtpPort", "smtpUsername", "smtpPassword"] as const) {
    if (!value[field]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: "Complete SMTP settings are required when SMTP is enabled."
      });
    }
  }
});

function connectionError(provider: "IMAP" | "SMTP", error: unknown) {
  const detail = error instanceof Error ? error.message : "Unknown connection error";
  return NextResponse.json(
    {
      error: `${provider} connection failed. Check the host, port, security mode, username, and password.`,
      detail
    },
    { status: 400 }
  );
}

export async function GET() {
  const user = await getDefaultUser();
  const accounts = await prisma.mailAccount.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" }
  });

  return NextResponse.json(accounts.map(serializeAccount));
}

export async function POST(request: Request) {
  const user = await getDefaultUser();
  const input = AccountSchema.parse(await request.json());
  const smtpEnabled = Boolean(input.smtpHost);

  try {
    await validateImapConnection({
      host: input.imapHost,
      port: input.imapPort,
      security: input.imapSecurity,
      username: input.imapUsername,
      password: input.imapPassword
    });
  } catch (error) {
    return connectionError("IMAP", error);
  }

  if (smtpEnabled) {
    try {
      await validateSmtpConnection({
        host: input.smtpHost ?? "",
        port: input.smtpPort ?? 0,
        security: input.smtpSecurity ?? "ssl",
        username: input.smtpUsername ?? "",
        password: input.smtpPassword ?? ""
      });
    } catch (error) {
      return connectionError("SMTP", error);
    }
  }

  const account = await prisma.mailAccount.create({
    data: {
      userId: user.id,
      displayName: input.displayName,
      emailAddress: input.emailAddress,
      imapHost: input.imapHost,
      imapPort: input.imapPort,
      imapSecurity: input.imapSecurity,
      imapUsername: input.imapUsername,
      imapPasswordEncrypted: encryptSecret(input.imapPassword),
      smtpHost: input.smtpHost || null,
      smtpPort: input.smtpPort || null,
      smtpSecurity: input.smtpSecurity || null,
      smtpUsername: input.smtpUsername || null,
      smtpPasswordEncrypted: input.smtpPassword ? encryptSecret(input.smtpPassword) : null
    }
  });

  return NextResponse.json(serializeAccount(account), { status: 201 });
}
