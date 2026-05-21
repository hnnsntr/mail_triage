import type { Email } from "@prisma/client";
import { cleanBodyForAi } from "@/lib/mail/parser";

export type OutputLanguage = "de" | "en";

export type CustomCategory = { name: string; description?: string; excludeFromInbox?: boolean };

export const fallbackCategories: CustomCategory[] = [
  { name: "needs_attention_now", description: "Wichtig und erfordert Reaktion / Important and requires action." },
  { name: "invoice_or_payment", description: "Rechnungen und Zahlungen / Invoices and payments." },
  { name: "customer_or_business_request", description: "Kunden- oder Geschäftsanfragen / Customer or business requests." },
  { name: "appointment_or_scheduling", description: "Termine und Planung / Appointments and scheduling." },
  { name: "personal", description: "Privat / Personal." },
  { name: "advertisement", description: "Werbung / Advertisement." },
  { name: "newsletter", description: "Newsletter / Newsletters." },
  { name: "system_notification", description: "Systemmeldungen / System notifications." },
  { name: "receipt_or_order", description: "Belege und Bestellungen / Receipts and orders." },
  { name: "low_priority", description: "Niedrige Priorität / Low priority." },
  { name: "spam_or_noise", description: "Spam oder Rauschen / Spam or noise." }
];

export function getEmailTriageSystemPrompt(language: OutputLanguage, customCategories: CustomCategory[] = []) {
  const activeCategories = customCategories.length > 0 ? customCategories : fallbackCategories;

  if (language === "en") {
    const categoriesList = `\nAvailable categories:\n${activeCategories.map(c => `- ${c.name}${c.description ? `: ${c.description}` : ""}`).join("\n")}\n`;

    return `You are an Email Triage Assistant for a mailbox that receives emails in multiple languages.

Understand all formulations, invoices, appointments, deadlines, customer requests, newsletters, and system notifications regardless of their language.

Answer in English in the fields summary, suggested_action, todo.title, and todo.reason.

Important: The category field must never be translated. Prefer using one of the following categories if the content fits:
${categoriesList}
If none of these categories fit well, invent a more suitable category in snake_case (e.g. travel_and_booking, family_and_friends, subscriptions, taxes). The system will automatically create a folder for it.

Analyze emails and return ONLY valid JSON.

Do not invent facts.

Only suggest Todos if a real, concrete task is clearly recognizable.

Do not classify advertisements and newsletters as urgent.

If a real customer request, business inquiry, or concrete question/prompt is included and the email is not clearly an advertisement, newsletter, spam, or system noise, set category to needs_attention_now (or your most suitable category).

Do not infer content from attachment names, because attachment contents are not provided.`;
  }

  // German fallback/default
  const categoriesList = `\nVerfügbare Kategorien:\n${activeCategories.map(c => `- ${c.name}${c.description ? `: ${c.description}` : ""}`).join("\n")}\n`;

  return `Du bist ein E-Mail-Triage-Assistent fuer ein Postfach, das E-Mails in verschiedenen Sprachen erhaelt.

Verstehe alle Formulierungen, Rechnungen, Termine, Fristen, Kundenanfragen, Newsletter und Systemmeldungen unabhaengig von ihrer Sprache.

Antworte in den Feldern summary, suggested_action, todo.title und todo.reason auf Deutsch.

Wichtig: Das Feld category darf niemals uebersetzt werden. Verwende bevorzugt eine der folgenden Kategorien, falls der Inhalt passend ist:
${categoriesList}
Wenn keine dieser Kategorien gut passt, erfinde eine passendere Kategorie in snake_case (z.B. travel_and_booking, family_and_friends, subscriptions, taxes). Das System erstellt dafuer automatisch einen Ordner.

Analysiere E-Mails und gib ausschliesslich valides JSON zurueck.

Erfinde keine Fakten.

Schlage Todos nur vor, wenn eine echte konkrete Aufgabe klar erkennbar ist.

Klassifiziere Werbung und Newsletter nicht als dringend.

Wenn eine echte Kundenanfrage, Geschaeftsanfrage oder konkrete Frage/Aufforderung enthalten ist und die E-Mail nicht klar Werbung, Newsletter, Spam oder Systemrauschen ist, setze category auf needs_attention_now (oder deine passendste Kategorie).

Leite aus Anhangsnamen keine Inhalte ab, weil Anhangsinhalte nicht bereitgestellt werden.`;
}

export function buildEmailAnalysisPrompt(email: Email, language: OutputLanguage, customCategories: CustomCategory[] = []) {
  const activeCategories = customCategories.length > 0 ? customCategories : fallbackCategories;
  const customNames = activeCategories.map(c => c.name).join(", ");
  
  const instruction = language === "en" 
    ? "Return summary, suggested_action, and todo fields in English."
    : "Gib summary, suggested_action und todo-Felder auf Deutsch zurueck.";

  const customHint = language === "en"
    ? ` Use one of these categories if applicable: ${customNames}.`
    : ` Verwende eine dieser Kategorien falls passend: ${customNames}.`;

  const orInventHint = language === "en"
    ? " Or invent a new one based on content."
    : " Oder erfinde eine neue passend zum Inhalt.";

  return `Analysiere diese E-Mail. / Analyze this email.

Betreff/Subject: ${email.subject}
Von/From: ${email.fromName ?? ""} <${email.fromEmail}>
Datum/Date: ${email.date.toISOString()}

Anhang-Metadaten / Attachment metadata:
${JSON.stringify(email.attachmentMetadata, null, 2)}

Text:
${cleanBodyForAi(email.plainTextBody)}

${instruction}

Gib JSON passend zu diesem Schema zurueck: / Return JSON matching this schema:
{
  "category": "A snake_case string.${customHint}${orInventHint}",
  "importance_score": 0,
  "urgency_score": 0,
  "summary": "...",
  "suggested_action": "...",
  "todo": {
    "should_create": false,
    "title": null,
    "due_date": null,
    "reason": null
  },
  "confidence": 0.0
}`;
}
