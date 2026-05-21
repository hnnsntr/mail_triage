import OpenAI from "openai";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { buildEmailAnalysisPrompt, getEmailTriageSystemPrompt, type OutputLanguage } from "./prompts";

const categories = [
  "needs_attention_now",
  "invoice_or_payment",
  "customer_or_business_request",
  "appointment_or_scheduling",
  "personal",
  "advertisement",
  "newsletter",
  "system_notification",
  "receipt_or_order",
  "low_priority",
  "spam_or_noise"
];

const categoryAliases: Record<string, string> = {
  dringend: "needs_attention_now",
  aufmerksamkeit: "needs_attention_now",
  "braucht aufmerksamkeit": "needs_attention_now",
  attention: "needs_attention_now",
  invoice: "invoice_or_payment",
  rechnung: "invoice_or_payment",
  zahlung: "invoice_or_payment",
  payment: "invoice_or_payment",
  kunde: "customer_or_business_request",
  kundenanfrage: "customer_or_business_request",
  business: "customer_or_business_request",
  appointment: "appointment_or_scheduling",
  termin: "appointment_or_scheduling",
  scheduling: "appointment_or_scheduling",
  planung: "appointment_or_scheduling",
  privat: "personal",
  persoenlich: "personal",
  persönlich: "personal",
  personal: "personal",
  werbung: "advertisement",
  advertisement: "advertisement",
  ad: "advertisement",
  newsletter: "newsletter",
  system: "system_notification",
  systemmeldung: "system_notification",
  benachrichtigung: "system_notification",
  receipt: "receipt_or_order",
  beleg: "receipt_or_order",
  bestellung: "receipt_or_order",
  order: "receipt_or_order",
  niedrig: "low_priority",
  "niedrige prioritaet": "low_priority",
  "niedrige priorität": "low_priority",
  low: "low_priority",
  spam: "spam_or_noise",
  noise: "spam_or_noise",
  rauschen: "spam_or_noise"
};

const AnalysisSchema = z.object({
  category: z.preprocess((value) => {
    if (typeof value !== "string") return "low_priority";
    const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
    return categoryAliases[normalized] ?? normalized;
  }, z.string()),
  importance_score: z.number().int().min(0).max(100),
  urgency_score: z.number().int().min(0).max(100),
  summary: z.string().min(1).max(1000),
  suggested_action: z.string().nullable().optional(),
  todo: z.object({
    should_create: z.boolean(),
    title: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
    reason: z.string().nullable().optional()
  }),
  confidence: z.number().min(0).max(1)
});

type AnalysisResult = z.infer<typeof AnalysisSchema>;

function fallbackAnalysis(language: OutputLanguage): AnalysisResult {
  return {
    category: "low_priority",
    importance_score: 35,
    urgency_score: 20,
    summary:
      language === "de"
        ? "Diese E-Mail wurde noch nicht analysiert, weil der KI-Dienst nicht verfuegbar ist."
        : "This email has not been analyzed yet because the AI service is unavailable.",
    suggested_action: language === "de" ? "Manuell pruefen." : "Review manually.",
    todo: {
      should_create: false,
      title: null,
      due_date: null,
      reason: null
    },
    confidence: 0.2
  };
}

function parseDueDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shouldEscalateBusinessRequest(email: { subject: string; plainTextBody: string }, parsed: AnalysisResult) {
  if (parsed.category !== "customer_or_business_request") {
    return false;
  }

  const text = `${email.subject}\n${email.plainTextBody}`.toLowerCase();
  const negativeSignals = [
    "newsletter",
    "unsubscribe",
    "abmelden",
    "werbung",
    "rabatt",
    "sale",
    "angebot der woche",
    "no-reply",
    "noreply"
  ];
  const requestSignals = [
    "?",
    "bitte",
    "koennen sie",
    "können sie",
    "kannst du",
    "koennten sie",
    "könnten sie",
    "ich brauche",
    "wir brauchen",
    "benoetigen",
    "benötigen",
    "anfrage",
    "angebot",
    "termin",
    "rueckmeldung",
    "rückmeldung",
    "antwort",
    "frage",
    "problem",
    "auftrag",
    "bestellung",
    "could you",
    "can you",
    "please",
    "request",
    "question",
    "quote",
    "proposal",
    "appointment",
    "reply"
  ];

  if (negativeSignals.some((signal) => text.includes(signal))) {
    return false;
  }

  return requestSignals.some((signal) => text.includes(signal));
}

export async function analyzeEmail(emailId: string) {
  const email = await prisma.email.findUniqueOrThrow({
    where: { id: emailId },
    include: {
      account: {
        include: {
          user: {
            include: {
              settings: true
            }
          }
        }
      }
    }
  });

  const language = email.account.user.settings?.language === "en" ? "en" : "de";
  const model = email.account.user.settings?.openaiModel || process.env.OPENAI_MODEL || "gpt-5.4-mini";
  const apiKey = email.account.user.settings?.openAIKey || process.env.OPENAI_API_KEY;
  const customCategoriesRaw = email.account.user.settings?.customCategories;
  const customCategories = (Array.isArray(customCategoriesRaw) ? customCategoriesRaw : []) as { name: string; description?: string }[];

  let parsed: AnalysisResult = fallbackAnalysis(language);

  if (apiKey) {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: getEmailTriageSystemPrompt(language, customCategories) },
        { role: "user", content: buildEmailAnalysisPrompt(email, language, customCategories) }
      ]
    });

    const content = completion.choices[0]?.message.content ?? "{}";
    parsed = AnalysisSchema.parse(JSON.parse(content));
  }

  if (shouldEscalateBusinessRequest(email, parsed)) {
    parsed = {
      ...parsed,
      category: "needs_attention_now",
      importance_score: Math.max(parsed.importance_score, 75),
      urgency_score: Math.max(parsed.urgency_score, 65)
    };
  }

  return prisma.emailAnalysis.upsert({
    where: { emailId: email.id },
    create: {
      emailId: email.id,
      category: parsed.category,
      importanceScore: parsed.importance_score,
      urgencyScore: parsed.urgency_score,
      summary: parsed.summary,
      suggestedAction: parsed.suggested_action ?? null,
      todoShouldCreate: parsed.todo.should_create,
      todoTitle: parsed.todo.title ?? null,
      todoDueDate: parseDueDate(parsed.todo.due_date),
      todoReason: parsed.todo.reason ?? null,
      confidence: parsed.confidence
    },
    update: {
      category: parsed.category,
      importanceScore: parsed.importance_score,
      urgencyScore: parsed.urgency_score,
      summary: parsed.summary,
      suggestedAction: parsed.suggested_action ?? null,
      todoShouldCreate: parsed.todo.should_create,
      todoTitle: parsed.todo.title ?? null,
      todoDueDate: parseDueDate(parsed.todo.due_date),
      todoReason: parsed.todo.reason ?? null,
      confidence: parsed.confidence,
      createdAt: new Date()
    }
  });
}
