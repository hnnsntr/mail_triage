import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getDefaultUser } from "@/lib/db/prisma";

const fallbackModels = ["gpt-5.4-mini", "gpt-5.4-nano", "gpt-5.4", "gpt-5.5", "chat-latest"];

function isUsableTextModel(id: string) {
  return (
    (id.startsWith("gpt-") || id === "chat-latest") &&
    !id.includes("image") &&
    !id.includes("audio") &&
    !id.includes("realtime") &&
    !id.includes("transcribe") &&
    !id.includes("tts") &&
    !id.includes("embedding") &&
    !id.includes("moderation")
  );
}

function recommendation(id: string) {
  if (id === "gpt-5.4-mini") return "recommended";
  if (id === "gpt-5.4-nano" || id === "gpt-5-mini" || id === "gpt-5-nano") return "fastest";
  if (id === "gpt-5.5" || id === "gpt-5.4") return "highest_quality";
  if (id === "chat-latest") return "latest_chat";
  if (id.includes("mini")) return "cost_effective";
  return "available";
}

function modelLabel(id: string) {
  return id
    .replace(/^gpt-/, "GPT-")
    .replace(/-/g, " ")
    .replace(/\bmini\b/i, "mini")
    .replace(/\bnano\b/i, "nano");
}

export async function GET() {
  const user = await getDefaultUser();
  const apiKey = user.settings?.openAIKey || process.env.OPENAI_API_KEY;

  let ids = fallbackModels;
  let source: "api" | "fallback" = "fallback";

  if (apiKey) {
    try {
      const client = new OpenAI({ apiKey });
      const models = await client.models.list();
      const available = models.data.map((model) => model.id).filter(isUsableTextModel);
      ids = Array.from(new Set([...fallbackModels.filter((id) => available.includes(id)), ...available])).sort();
      source = "api";
    } catch {
      source = "fallback";
    }
  }

  if (user.settings?.openaiModel && !ids.includes(user.settings.openaiModel)) {
    ids.unshift(user.settings.openaiModel);
  }

  return NextResponse.json({
    selected: user.settings?.openaiModel ?? "gpt-5.4-mini",
    source,
    models: ids.map((id) => ({
      id,
      label: modelLabel(id),
      recommendation: recommendation(id)
    }))
  });
}
