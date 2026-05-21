import { NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultUser, prisma } from "@/lib/db/prisma";
import { serializeSettings } from "@/lib/state/serializers";

const SettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  language: z.enum(["de", "en"]).optional(),
  openaiModel: z.string().min(1).optional(),
  lastFolder: z.string().optional(),
  lastCategory: z.string().nullable().optional(),
  lastSearch: z.string().nullable().optional(),
  syncIntervalSecs: z.coerce.number().int().min(30).max(3600).optional(),
  customCategories: z.array(z.object({
    name: z.string().min(1).max(50),
    description: z.string().max(200).optional(),
    excludeFromInbox: z.boolean().optional()
  })).optional(),
  openAIKey: z.string().optional().nullable(),
  todoistKey: z.string().optional().nullable()
});

export async function GET() {
  const user = await getDefaultUser();
  return NextResponse.json(serializeSettings(user.settings));
}

export async function PATCH(request: Request) {
  const user = await getDefaultUser();
  const input = SettingsSchema.parse(await request.json());

  const settings = await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      ...input
    },
    update: input
  });

  return NextResponse.json(serializeSettings(settings));
}
