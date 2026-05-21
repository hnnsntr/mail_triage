import { NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultUser, prisma } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/security/encryption";
import { serializeAccount } from "@/lib/state/serializers";

const UpdateAccountSchema = z.object({
  displayName: z.string().min(1).optional(),
  emailAddress: z.string().email().optional(),
  imapHost: z.string().min(1).optional(),
  imapPort: z.coerce.number().int().positive().optional(),
  imapSecurity: z.enum(["ssl", "starttls", "none"]).optional(),
  imapUsername: z.string().min(1).optional(),
  imapPassword: z.string().min(1).optional(),
  smtpHost: z.string().nullable().optional(),
  smtpPort: z.coerce.number().int().positive().nullable().optional(),
  smtpSecurity: z.enum(["ssl", "starttls", "none"]).nullable().optional(),
  smtpUsername: z.string().nullable().optional(),
  smtpPassword: z.string().nullable().optional(),
  isEnabled: z.boolean().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getDefaultUser();
  const input = UpdateAccountSchema.parse(await request.json());
  const { imapPassword, smtpPassword, ...accountInput } = input;

  const account = await prisma.mailAccount.update({
    where: {
      id,
      userId: user.id
    },
    data: {
      ...accountInput,
      imapPasswordEncrypted: imapPassword ? encryptSecret(imapPassword) : undefined,
      smtpPasswordEncrypted:
        smtpPassword === undefined
          ? undefined
          : smtpPassword
            ? encryptSecret(smtpPassword)
            : null,
    }
  });

  return NextResponse.json(serializeAccount(account));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getDefaultUser();

  await prisma.mailAccount.delete({
    where: {
      id,
      userId: user.id
    }
  });

  return NextResponse.json({ ok: true });
}
