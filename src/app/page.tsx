"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  Bell,
  Check,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Inbox,
  Loader2,
  Mail,
  MailCheck,
  MailOpen,
  Moon,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Settings,
  Sparkles,
  Sun,
  Tag,
  Paperclip,
  Trophy,
  Trash2
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Account = {
  id: string;
  displayName: string;
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  imapSecurity: string;
  imapUsername: string;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecurity?: string | null;
  smtpUsername?: string | null;
  isEnabled: boolean;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
};

type Analysis = {
  category: string;
  importanceScore: number;
  urgencyScore: number;
  summary: string;
  suggestedAction?: string | null;
  todoShouldCreate: boolean;
  todoTitle?: string | null;
  todoDueDate?: string | null;
  todoReason?: string | null;
  confidence: number;
};

type Email = {
  id: string;
  subject: string;
  fromName?: string | null;
  fromEmail: string;
  date: string;
  isRead: boolean;
  hasAttachments: boolean;
  snippet: string;
  plainTextBody: string;
  attachmentMetadata: Array<{
    filename: string;
    mimeType: string;
    size: number;
  }>;
  folder: string;
  analysis?: Analysis | null;
};

type Todo = {
  id: string;
  emailId?: string | null;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  status: "open" | "done" | "ignored";
  createdFromAi: boolean;
  todoistId?: string | null;
  todoistUrl?: string | null;
};

type Language = "de" | "en";

type AppSettings = {
  theme: "light" | "dark" | "system";
  language: Language;
  openaiModel: string;
  lastFolder: string;
  lastCategory?: string | null;
  lastSearch?: string | null;
  syncIntervalSecs: number;
  customCategories?: Array<{ name: string; description?: string; excludeFromInbox?: boolean }>;
  openAIKey?: string | null;
  todoistKey?: string | null;
};

type SyncResponse = {
  synced: Array<{
    accountId: string;
    imported: number;
    skipped: boolean;
  }>;
};

type AnalyzeResponse = {
  analyzed: number;
};

type OpenAIModelOption = {
  id: string;
  label: string;
  recommendation: string;
};

type OpenAIModelsResponse = {
  selected: string;
  source: "api" | "fallback";
  models: OpenAIModelOption[];
};

type MailStats = {
  unread: number;
  readToday: number;
  totalInbox: number;
  todayStartedAt: string;
  categoryCounts?: Array<{ category: string; count: number }>;
};

const coreNavItems = [
  { key: "inbox", label: { de: "Posteingang", en: "Inbox" }, icon: Inbox },
  { key: "todos", label: { de: "Todos", en: "Todos" }, icon: ClipboardList },
  { key: "accounts", label: { de: "Konten", en: "Accounts" }, icon: Mail },
  { key: "settings", label: { de: "Einstellungen", en: "Settings" }, icon: Settings }
];

const categoryIcons: Record<string, any> = {
  needs_attention_now: Bell,
  invoice_or_payment: CreditCard,
  customer_or_business_request: MailCheck,
  appointment_or_scheduling: Bell,
  advertisement: Send,
  newsletter: Send,
  receipt_or_order: CreditCard,
  low_priority: Archive,
  spam_or_noise: Trash2
};

const categoryLabels: Record<Language, Record<string, string>> = {
  de: {
    needs_attention_now: "Dringend",
    invoice_or_payment: "Rechnung",
    customer_or_business_request: "Kunde",
    appointment_or_scheduling: "Termin",
    personal: "Privat",
    advertisement: "Werbung",
    newsletter: "Newsletter",
    system_notification: "System",
    receipt_or_order: "Beleg",
    low_priority: "Niedrig",
    spam_or_noise: "Spam"
  },
  en: {
    needs_attention_now: "Attention",
    invoice_or_payment: "Invoice",
    customer_or_business_request: "Business",
    appointment_or_scheduling: "Scheduling",
    personal: "Personal",
    advertisement: "Ad",
    newsletter: "Newsletter",
    system_notification: "System",
    receipt_or_order: "Receipt",
    low_priority: "Low",
    spam_or_noise: "Spam"
  }
};

const copy = {
  de: {
    unread: "ungelesen",
    inboxEyebrow: "Posteingang",
    priorityMail: "Priorisierte Mails",
    toggleTheme: "Design wechseln",
    pull: "Abrufen",
    analyze: "Analysieren",
    pulling: "Mails werden abgerufen...",
    analyzing: "KI-Analyse laeuft...",
    pulled: (count: number) => `${count} Mail${count === 1 ? "" : "s"} abgerufen.`,
    analyzed: (count: number) => `${count} Mail${count === 1 ? "" : "s"} analysiert.`,
    syncFailed: "Synchronisierung fehlgeschlagen",
    analysisFailed: "Analyse fehlgeschlagen",
    search: "Mails suchen",
    unreadOnly: "Nur ungelesene",
    all: "Alle",
    inboxGame: "Heute verarbeitet",
    left: "uebrig",
    doneToday: "heute erledigt",
    streak: "Inbox-Run",
    selectMessage: "Nachricht auswaehlen",
    unanalyzed: "Nicht analysiert",
    unreadBadge: "Ungelesen",
    readBadge: "Gelesen",
    noAnalysis: "Noch keine Analyse.",
    importance: "Wichtigkeit",
    urgency: "Dringlichkeit",
    action: "Aktion",
    reviewManually: "Manuell pruefen.",
    attachments: "Anhaenge",
    createTodo: "Todo erstellen",
    markUnread: "Als ungelesen",
    markRead: "Als gelesen",
    archive: "Archivieren",
    reanalyze: "Neu analysieren",
    ignore: "Ignorieren",
    sendToTodoist: "An Todoist senden",
    todoistSuccess: "Erfolgreich an Todoist gesendet!",
    openInTodoist: "In Todoist öffnen?",
    todoCreated: "Todo erfolgreich erstellt!",
    todoAlreadyCreated: "Bereits erstellt",
    accounts: {
      deleteConfirm: (name: string) =>
        `Konto "${name}" wirklich loeschen? Gespeicherte Mails und Analysen dieses Kontos werden entfernt.`,
      deleteFailed: "Konto konnte nicht geloescht werden.",
      connectionFailed: "Verbindungspruefung fehlgeschlagen.",
      active: "Aktiv",
      error: "Fehler",
      delete: "Konto loeschen",
      lastSync: "Zuletzt abgerufen",
      neverSynced: "Noch nicht abgerufen",
      add: "Konto hinzufuegen",
      displayName: "Anzeigename",
      emailAddress: "E-Mail-Adresse",
      security: "Sicherheit",
      imapUsername: "IMAP Benutzername",
      imapPassword: "IMAP Passwort",
      smtpHint: "Wird spaeter zum Senden verwendet.",
      sameCredentials: "Gleiche Zugangsdaten",
      smtpUsername: "SMTP Benutzername",
      smtpPassword: "SMTP Passwort",
      checking: "Verbindung wird geprueft",
      checkSave: "Pruefen und speichern"
    },
    settings: {
      title: "Einstellungen",
      language: "Sprache",
      german: "Deutsch",
      english: "English",
      design: "Design",
      light: "Hell",
      dark: "Dunkel",
      syncInterval: "Sync-Intervall",
      save: "Speichern",
      state: "Status",
      lastFolder: "Letzter Ordner",
      lastView: "Letzte Ansicht",
      customCategories: "Eigene KI-Ordner",
      categoryName: "Ordnername (z.B. reisen)",
      categoryDesc: "Instruktion für die KI (optional)",
      addCategory: "Hinzufügen",
      excludeFromInbox: "Nicht im Posteingang anzeigen",
      openAIKey: "OpenAI API Key (optional)",
      todoistKey: "Todoist API Key (optional)"
    },
    empty: {
      nothing: "Hier ist nichts",
      noAccount: "Kein Konto verbunden",
      syncOrFilter: "Synchronisiere oder passe die Filter an.",
      addAccount: "Oeffne Konten, um IMAP- und SMTP-Daten einzutragen."
    }
  },
  en: {
    unread: "unread",
    inboxEyebrow: "Inbox",
    priorityMail: "Priority mail",
    toggleTheme: "Toggle theme",
    pull: "Pull",
    analyze: "Analyze",
    pulling: "Pulling mail...",
    analyzing: "AI analysis running...",
    pulled: (count: number) => `${count} email${count === 1 ? "" : "s"} pulled.`,
    analyzed: (count: number) => `${count} email${count === 1 ? "" : "s"} analyzed.`,
    syncFailed: "Sync failed",
    analysisFailed: "Analysis failed",
    search: "Search mail",
    unreadOnly: "Unread only",
    all: "All",
    inboxGame: "Processed today",
    left: "left",
    doneToday: "done today",
    streak: "Inbox run",
    selectMessage: "Select a message",
    unanalyzed: "Unanalyzed",
    unreadBadge: "Unread",
    readBadge: "Read",
    noAnalysis: "No analysis yet.",
    importance: "Importance",
    urgency: "Urgency",
    action: "Action",
    reviewManually: "Review manually.",
    attachments: "Attachments",
    createTodo: "Create todo",
    markUnread: "Mark unread",
    markRead: "Mark read",
    archive: "Archive",
    reanalyze: "Re-analyze",
    ignore: "Ignore",
    sendToTodoist: "Send to Todoist",
    todoistSuccess: "Successfully sent to Todoist!",
    openInTodoist: "Open in Todoist?",
    todoCreated: "Todo created successfully!",
    todoAlreadyCreated: "Already created",
    accounts: {
      deleteConfirm: (name: string) =>
        `Delete account "${name}"? Stored mail and analyses for this account will be removed.`,
      deleteFailed: "Could not delete account.",
      connectionFailed: "Connection check failed.",
      active: "Active",
      error: "Error",
      delete: "Delete account",
      lastSync: "Last pulled",
      neverSynced: "Not pulled yet",
      add: "Add account",
      displayName: "Display name",
      emailAddress: "Email address",
      security: "Security",
      imapUsername: "IMAP username",
      imapPassword: "IMAP password",
      smtpHint: "Used later for sending replies.",
      sameCredentials: "Same credentials",
      smtpUsername: "SMTP username",
      smtpPassword: "SMTP password",
      checking: "Checking connection",
      checkSave: "Check and save"
    },
    settings: {
      title: "Settings",
      language: "Language",
      german: "Deutsch",
      english: "English",
      design: "Theme",
      light: "Light",
      dark: "Dark",
      syncInterval: "Sync interval",
      save: "Save",
      state: "State",
      lastFolder: "Last folder",
      lastView: "Last view",
      customCategories: "Custom AI Folders",
      categoryName: "Folder name (e.g. travel)",
      categoryDesc: "Instructions for AI (optional)",
      addCategory: "Add",
      excludeFromInbox: "Exclude from inbox",
      openAIKey: "OpenAI API Key (optional)",
      todoistKey: "Todoist API Key (optional)"
    },
    empty: {
      nothing: "Nothing here",
      noAccount: "No account connected",
      syncOrFilter: "Sync or adjust filters to load messages.",
      addAccount: "Open Accounts to add IMAP and SMTP settings."
    }
  }
};

type AppCopy = typeof copy.de;

function formatCategory(category: string) {
  return category.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function categoryTone(category?: string | null) {
  if (category === "needs_attention_now") return "red";
  if (category === "invoice_or_payment" || category === "appointment_or_scheduling") return "amber";
  if (category === "customer_or_business_request" || category === "personal") return "blue";
  if (category === "receipt_or_order") return "green";
  return "neutral";
}

function mailQueryForView(view: string, excludedCategories: string[] = []) {
  const params = new URLSearchParams({ folder: "Inbox" });

  if (view === "inbox") {
    if (excludedCategories.length > 0) {
      params.set("excludeCategories", excludedCategories.join(","));
    }
  } else if (!["accounts", "settings", "todos"].includes(view)) {
    params.set("category", view);
  }

  return params;
}

async function jsonFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    }
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: string; detail?: string };
      message = [parsed.error, parsed.detail].filter(Boolean).join(" ") || text;
    } catch {
      message = text;
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export default function Home() {
  const [view, setView] = useState("inbox");
  const [emails, setEmails] = useState<Email[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [stats, setStats] = useState<MailStats | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = emails.find((email) => email.id === selectedId) ?? emails[0] ?? null;
  const language: Language = settings?.language === "en" ? "en" : "de";
  const c = copy[language];

  const activeCustomCategories = useMemo(() => {
    const fromSettings = settings?.customCategories?.map(c => ({ name: c.name, description: c.description || "", excludeFromInbox: !!c.excludeFromInbox })) ?? [];
    if (fromSettings.length > 0) return fromSettings;
    return [
      { name: "needs_attention_now", description: language === "de" ? "Wichtig und erfordert Reaktion." : "Important and requires action.", excludeFromInbox: false },
      { name: "invoice_or_payment", description: language === "de" ? "Rechnungen und Zahlungen." : "Invoices and payments.", excludeFromInbox: true },
      { name: "customer_or_business_request", description: language === "de" ? "Kunden- oder Geschäftsanfragen." : "Customer or business requests.", excludeFromInbox: false },
      { name: "appointment_or_scheduling", description: language === "de" ? "Termine und Planung." : "Appointments and scheduling.", excludeFromInbox: false },
      { name: "personal", description: language === "de" ? "Privat." : "Personal.", excludeFromInbox: false },
      { name: "advertisement", description: language === "de" ? "Werbung." : "Advertisement.", excludeFromInbox: true },
      { name: "newsletter", description: language === "de" ? "Newsletter." : "Newsletters.", excludeFromInbox: true },
      { name: "system_notification", description: language === "de" ? "Systemmeldungen." : "System notifications.", excludeFromInbox: false },
      { name: "receipt_or_order", description: language === "de" ? "Belege und Bestellungen." : "Receipts and orders.", excludeFromInbox: true },
      { name: "low_priority", description: language === "de" ? "Niedrige Priorität." : "Low priority.", excludeFromInbox: false },
      { name: "spam_or_noise", description: language === "de" ? "Spam oder Rauschen." : "Spam or noise.", excludeFromInbox: true }
    ];
  }, [settings?.customCategories, language]);

  const excludedCategoryNames = useMemo(() => activeCustomCategories.filter(c => c.excludeFromInbox).map(c => c.name), [activeCustomCategories]);

  const headerInfo = useMemo(() => {
    if (view === "inbox") {
      return {
        eyebrow: c.inboxEyebrow,
        title: c.priorityMail
      };
    }
    if (view === "todos") {
      return {
        eyebrow: language === "de" ? "Aufgaben" : "Tasks",
        title: language === "de" ? "Deine Todos" : "Your Todos"
      };
    }
    if (view === "accounts") {
      return {
        eyebrow: "E-Mail",
        title: language === "de" ? "E-Mail-Konten" : "Email Accounts"
      };
    }
    
    // AI Category Folders
    const customCat = activeCustomCategories.find(cc => cc.name === view);
    const categoryTitle = categoryLabels[language][view] ?? formatCategory(view);
    return {
      eyebrow: language === "de" ? "KI-Ordner" : "AI Folder",
      title: categoryTitle
    };
  }, [view, language, activeCustomCategories, c.inboxEyebrow, c.priorityMail]);


  async function refreshData(nextView = view, nextExcluded = excludedCategoryNames) {
    setError(null);
    const params = mailQueryForView(nextView, nextExcluded);
    if (unreadOnly) {
      params.set("status", "unread");
    }
    const [emailData, accountData, todoData, statsData] = await Promise.all([
      jsonFetch<Email[]>(`/api/mail/emails?${params.toString()}`),
      jsonFetch<Account[]>("/api/accounts"),
      jsonFetch<Todo[]>("/api/todos"),
      jsonFetch<MailStats>("/api/mail/stats")
    ]);

    setEmails(emailData);
    setAccounts(accountData);
    setTodos(todoData);
    setStats(statsData);
    setSelectedId((current) => current ?? emailData[0]?.id ?? null);
  }

  useEffect(() => {
    jsonFetch<AppSettings>("/api/settings")
      .then((loadedSettings) => {
        setSettings(loadedSettings);
        if (loadedSettings.theme === "dark" || loadedSettings.theme === "light") {
          setTheme(loadedSettings.theme);
        }
        const fromSettings = loadedSettings.customCategories?.map(c => ({ name: c.name, description: c.description || "", excludeFromInbox: !!c.excludeFromInbox })) ?? [];
        const active = fromSettings.length > 0 ? fromSettings : [
          { name: "invoice_or_payment", excludeFromInbox: true },
          { name: "advertisement", excludeFromInbox: true },
          { name: "newsletter", excludeFromInbox: true },
          { name: "receipt_or_order", excludeFromInbox: true },
          { name: "spam_or_noise", excludeFromInbox: true }
        ];
        const excluded = active.filter(c => c.excludeFromInbox).map(c => c.name);
        refreshData(view, excluded).catch((err: Error) => setError(err.message));
      })
      .catch((err: Error) => {
        setError(err.message);
        refreshData(view, excludedCategoryNames).catch(console.error);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  async function pullMails() {
    setBusy(true);
    setError(null);
    setStatusMessage(c.pulling);
    try {
      const result = await jsonFetch<SyncResponse>("/api/mail/sync", { method: "POST" });
      await refreshData();
      const imported = result.synced.reduce((sum, item) => sum + item.imported, 0);
      setStatusMessage(c.pulled(imported));
    } catch (err) {
      setError(err instanceof Error ? err.message : c.syncFailed);
      setStatusMessage(null);
    } finally {
      setBusy(false);
    }
  }

  async function analyzeUnreadBatch() {
    setAnalyzing(true);
    setError(null);
    setStatusMessage(c.analyzing);
    try {
      const result = await jsonFetch<AnalyzeResponse>("/api/ai/analyze", {
        method: "POST",
        body: JSON.stringify({})
      });
      await refreshData();
      setStatusMessage(c.analyzed(result.analyzed));
    } catch (err) {
      setError(err instanceof Error ? err.message : c.analysisFailed);
      setStatusMessage(null);
    } finally {
      setAnalyzing(false);
    }
  }

  async function persistTheme(nextTheme: "light" | "dark") {
    setTheme(nextTheme);
    const updated = await jsonFetch<AppSettings>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ theme: nextTheme })
    });
    setSettings(updated);
  }

  async function searchEmails(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) {
      await refreshData();
      return;
    }

    setBusy(true);
    try {
      setEmails(await jsonFetch<Email[]>(`/api/mail/search?q=${encodeURIComponent(query)}`));
    } finally {
      setBusy(false);
    }
  }

  async function patchEmail(action: "mark_read" | "mark_unread" | "archive" | "ignore_suggestion") {
    if (!selected) return;
    const updated = await jsonFetch<Email>(`/api/mail/emails/${selected.id}`, {
      method: "PATCH",
      body: JSON.stringify({ action })
    });
    setEmails((items) => {
      const nextItems =
        action === "archive" || (unreadOnly && action === "mark_read")
          ? items.filter((item) => item.id !== selected.id)
          : items.map((item) => (item.id === updated.id ? updated : item));
      if (!nextItems.some((item) => item.id === selected.id)) {
        setSelectedId(nextItems[0]?.id ?? null);
      }
      return nextItems;
    });
    setStats(await jsonFetch<MailStats>("/api/mail/stats"));
  }

  async function reanalyzeEmail() {
    if (!selected) return;
    setBusy(true);
    try {
      await jsonFetch("/api/ai/analyze", {
        method: "POST",
        body: JSON.stringify({ emailId: selected.id })
      });
      await refreshData();
    } finally {
      setBusy(false);
    }
  }

  async function createTodoFromSuggestion() {
    if (!selected) return;
    try {
      const todo = await jsonFetch<Todo>("/api/todos", {
        method: "POST",
        body: JSON.stringify({ emailId: selected.id })
      });
      setTodos((items) => [todo, ...items]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create Todo");
    }
  }

  useEffect(() => {
    if (!loading) {
      refreshData().catch((err: Error) => setError(err.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly]);

  const unreadCount = stats?.unread ?? emails.filter((email) => !email.isRead).length;
  const progressTotal = (stats?.readToday ?? 0) + (stats?.unread ?? 0);
  const progressPercent = progressTotal > 0 ? Math.round(((stats?.readToday ?? 0) / progressTotal) * 100) : 100;

  return (
    <main className="min-h-screen p-4 text-foreground md:p-6">
      <div className={cn(
        "mx-auto grid h-[calc(100vh-2rem)] max-w-[1600px] grid-cols-1 overflow-hidden rounded-lg border border-border bg-background/86 shadow-soft backdrop-blur md:h-[calc(100vh-3rem)]",
        view === "settings" ? "lg:grid-cols-[236px_1fr]" : "lg:grid-cols-[236px_minmax(360px,480px)_1fr]"
      )}>
        <aside className="hidden border-r border-border bg-card/80 p-4 lg:block">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">AI Mailing</h1>
              <p className="text-xs text-muted-foreground">{unreadCount} {c.unread}</p>
            </div>
          </div>

          <nav className="space-y-1">
            {coreNavItems.map((item) => {
              const Icon = item.icon;
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setView(item.key);
                    jsonFetch<AppSettings>("/api/settings", { method: "PATCH", body: JSON.stringify({ lastFolder: "Inbox", lastCategory: item.key }) }).then(setSettings).catch(console.error);
                    if (!["accounts", "settings", "todos"].includes(item.key)) refreshData(item.key).catch(console.error);
                  }}
                  className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label[language]}</span>
                </button>
              );
            })}

            {activeCustomCategories.length > 0 && (
              <>
                <div className="mt-6 mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  AI Folders
                </div>
                {activeCustomCategories.map((c) => {
                  const active = view === c.name;
                  const Icon = categoryIcons[c.name] || Tag;
                  const count = stats?.categoryCounts?.find(sc => sc.category === c.name)?.count ?? 0;
                  return (
                    <button
                      key={c.name}
                      onClick={() => {
                        setView(c.name);
                        jsonFetch<AppSettings>("/api/settings", { method: "PATCH", body: JSON.stringify({ lastFolder: "Inbox", lastCategory: c.name }) }).then(setSettings).catch(console.error);
                        refreshData(c.name).catch(console.error);
                      }}
                      className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1 text-left">{categoryLabels[language][c.name] ?? formatCategory(c.name)}</span>
                      {count > 0 && (
                        <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold", c.name === "needs_attention_now" ? "bg-red-500 text-white" : "bg-muted-foreground/20 text-muted-foreground")}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </nav>
        </aside>

        <section className={cn("flex min-h-0 flex-col bg-secondary/45", view !== "settings" && "border-r border-border")}>
          {view !== "settings" && (
            <header className="border-b border-border bg-card/65 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{headerInfo.eyebrow}</p>
                  <h2 className="text-2xl font-semibold">{headerInfo.title}</h2>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" onClick={() => persistTheme(theme === "dark" ? "light" : "dark")} title={c.toggleTheme}>
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                  <Button onClick={pullMails} disabled={busy || analyzing} title={c.pull}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    {c.pull}
                  </Button>
                  <Button onClick={analyzeUnreadBatch} disabled={busy || analyzing} title={c.analyze}>
                    {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {c.analyze}
                  </Button>
                </div>
              </div>
              {statusMessage ? (
                <div className="mb-3 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                  {statusMessage}
                </div>
              ) : null}
              <div className="mb-3 rounded-lg border border-border bg-background p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Trophy className="h-4 w-4 text-primary" />
                    {c.inboxGame}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats?.readToday ?? 0} {c.doneToday} · {unreadCount} {c.left}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-md bg-muted">
                  <motion.div
                    className="h-full rounded-md bg-primary"
                    initial={false}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 18 }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={unreadOnly ? "primary" : "secondary"}
                    onClick={() => setUnreadOnly((current) => !current)}
                  >
                    {unreadOnly ? <Check className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                    {unreadOnly ? c.unreadOnly : c.all} · {unreadCount}
                  </Button>
                  <span className="text-xs text-muted-foreground">{c.streak} {progressPercent}%</span>
                </div>
              </div>
              <form onSubmit={searchEmails} className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={c.search}
                  className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </form>
            </header>
          )}

          {error && view !== "settings" ? <div className="border-b border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}

          <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-stable">
            {loading ? (
              <LoadingList />
            ) : view === "accounts" ? (
              <AccountsPanel accounts={accounts} onCreated={() => refreshData()} c={c} />
            ) : view === "settings" ? (
              <SettingsPanel
                settings={settings}
                setSettings={setSettings}
                theme={theme}
                setTheme={persistTheme}
                c={c}
                language={language}
                activeCustomCategories={activeCustomCategories}
              />
            ) : view === "todos" ? (
              <TodoPanel todos={todos} setTodos={setTodos} c={c} />
            ) : emails.length === 0 ? (
              <EmptyInbox hasAccounts={accounts.length > 0} c={c} />
            ) : (
              <div className="space-y-2">
                {emails.map((email) => (
                  <EmailCard
                    key={email.id}
                    email={email}
                    language={language}
                    c={c}
                    active={selected?.id === email.id}
                    onSelect={() => setSelectedId(email.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {view !== "settings" && (
          <section className="hidden min-h-0 bg-card/72 lg:block">
            <AnimatePresence mode="wait">
              {selected ? (
                <EmailDetail
                  key={selected.id}
                  email={selected}
                  language={language}
                  c={c}
                  busy={busy}
                  onPatch={patchEmail}
                  onCreateTodo={createTodoFromSuggestion}
                  onReanalyze={reanalyzeEmail}
                  hasTodo={todos.some(t => t.emailId === selected.id)}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-10 text-center text-muted-foreground">
                  <div>
                    <MailOpen className="mx-auto mb-4 h-10 w-10" />
                    <p className="text-sm">{c.selectMessage}</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </section>
        )}
      </div>
    </main>
  );
}

function EmailCard({
  email,
  active,
  onSelect,
  language,
  c
}: {
  email: Email;
  active: boolean;
  onSelect: () => void;
  language: Language;
  c: AppCopy;
}) {
  const category = email.analysis?.category;
  return (
    <motion.button
      layout
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md",
        active && "border-primary/50 ring-2 ring-primary/15",
        !email.isRead && "border-l-4 border-l-primary"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("truncate text-sm", !email.isRead ? "font-semibold" : "font-medium")}>
            {email.fromName || email.fromEmail}
          </p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{email.subject}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(email.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      </div>
      <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
        {email.analysis?.summary ?? email.snippet}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {category ? <Badge tone={categoryTone(category)}>{categoryLabels[language][category] ?? formatCategory(category)}</Badge> : <Badge>{c.unanalyzed}</Badge>}
        {email.analysis?.todoShouldCreate ? <Badge tone="green">Todo</Badge> : null}
        {email.hasAttachments ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5" />
            {email.attachmentMetadata.length}
          </span>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {email.analysis ? `${email.analysis.importanceScore}%` : ""}
        </span>
      </div>
    </motion.button>
  );
}

function EmailDetail({
  email,
  busy,
  onPatch,
  onCreateTodo,
  onReanalyze,
  language,
  c,
  hasTodo
}: {
  email: Email;
  busy: boolean;
  onPatch: (action: "mark_read" | "mark_unread" | "archive" | "ignore_suggestion") => void;
  onCreateTodo: () => void;
  onReanalyze: () => void;
  language: Language;
  c: AppCopy;
  hasTodo: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="flex h-full flex-col"
    >
      <header className="border-b border-border p-6">
        <div className="mb-4 flex items-center gap-2">
          {email.analysis?.category ? (
            <Badge tone={categoryTone(email.analysis.category)}>{categoryLabels[language][email.analysis.category] ?? email.analysis.category}</Badge>
          ) : null}
          {!email.isRead ? <Badge tone="blue">{c.unreadBadge}</Badge> : <Badge>{c.readBadge}</Badge>}
        </div>
        <h2 className="max-w-3xl text-2xl font-semibold leading-tight">{email.subject}</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {email.fromName || email.fromEmail} ·{" "}
          {new Date(email.date).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
          })}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6 scrollbar-stable">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <article className="whitespace-pre-wrap rounded-lg border border-border bg-background p-5 text-sm leading-7">
            {email.plainTextBody || email.snippet}
          </article>
          <aside className="space-y-4">
            {email.attachmentMetadata.length ? (
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="mb-3 flex items-center gap-2 font-medium">
                  <Paperclip className="h-4 w-4 text-primary" />
                  {c.attachments}
                </div>
                <div className="space-y-2">
                  {email.attachmentMetadata.map((attachment, index) => (
                    <a
                      key={`${attachment.filename}-${index}`}
                      href={`/api/mail/emails/${email.id}/attachments/${index}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm transition hover:border-primary/40 hover:bg-accent"
                    >
                      <span className="min-w-0 truncate">{attachment.filename}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(attachment.size)}</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border border-border bg-background p-4">
              <div className="mb-3 flex items-center gap-2 font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                AI
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {email.analysis?.summary ?? c.noAnalysis}
              </p>
              {email.analysis ? (
                <div className="mt-4 space-y-3">
                  <Score label={c.importance} value={email.analysis.importanceScore} />
                  <Score label={c.urgency} value={email.analysis.urgencyScore} />
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-border bg-background p-4">
              <div className="mb-3 flex items-center gap-2 font-medium">
                <Tag className="h-4 w-4 text-primary" />
                {c.action}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {email.analysis?.suggestedAction ?? c.reviewManually}
              </p>
              {email.analysis && !email.analysis.todoShouldCreate ? (
                <Button 
                  className={cn("mt-4 w-full", hasTodo && "border-emerald-500 text-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:bg-emerald-950/50")} 
                  variant="secondary" 
                  disabled={hasTodo} 
                  onClick={onCreateTodo}
                >
                  {hasTodo ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  {hasTodo ? c.todoAlreadyCreated : c.createTodo}
                </Button>
              ) : null}
            </div>

            {email.analysis?.todoShouldCreate ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <ClipboardList className="h-4 w-4" />
                  {email.analysis.todoTitle}
                </div>
                <p className="text-sm leading-6 opacity-80">{email.analysis.todoReason}</p>
                <Button 
                  className={cn("mt-4 w-full", hasTodo && "border-emerald-500 text-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:bg-emerald-950/50")} 
                  variant={hasTodo ? "secondary" : "primary"} 
                  disabled={hasTodo} 
                  onClick={onCreateTodo}
                >
                  {hasTodo ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  {hasTodo ? c.todoAlreadyCreated : c.createTodo}
                </Button>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      <footer className="flex flex-wrap gap-2 border-t border-border p-4">
        <Button onClick={() => onPatch(email.isRead ? "mark_unread" : "mark_read")}>
          {email.isRead ? <Mail className="h-4 w-4" /> : <MailCheck className="h-4 w-4" />}
          {email.isRead ? c.markUnread : c.markRead}
        </Button>
        <Button onClick={() => onPatch("archive")}>
          <Archive className="h-4 w-4" />
          {c.archive}
        </Button>
        <Button onClick={onReanalyze} disabled={busy}>
          <Sparkles className="h-4 w-4" />
          {c.reanalyze}
        </Button>
        <Button variant="danger" onClick={() => onPatch("ignore_suggestion")}>
          <Trash2 className="h-4 w-4" />
          {c.ignore}
        </Button>
      </footer>
    </motion.div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-md bg-muted">
        <div className="h-full rounded-md bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function recommendationLabel(recommendation: string, language: Language) {
  const labels: Record<Language, Record<string, string>> = {
    de: {
      recommended: "Empfohlen fuer Mail-Triage",
      fastest: "Schnell und guenstig",
      highest_quality: "Beste Qualitaet",
      latest_chat: "Aktuellster Chat-Alias",
      cost_effective: "Kosteneffizient",
      available: "Verfuegbar"
    },
    en: {
      recommended: "Recommended for mail triage",
      fastest: "Fast and cheap",
      highest_quality: "Highest quality",
      latest_chat: "Latest chat alias",
      cost_effective: "Cost-effective",
      available: "Available"
    }
  };

  return labels[language][recommendation] ?? labels[language].available;
}

function AccountsPanel({ accounts, onCreated, c }: { accounts: Account[]; onCreated: () => void; c: AppCopy }) {
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sameSmtpCredentials, setSameSmtpCredentials] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: "",
    emailAddress: "",
    imapHost: "",
    imapPort: "993",
    imapSecurity: "ssl",
    imapUsername: "",
    imapPassword: "",
    smtpHost: "",
    smtpPort: "465",
    smtpSecurity: "ssl",
    smtpUsername: "",
    smtpPassword: ""
  });

  function updateForm(key: keyof typeof form, value: string) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (sameSmtpCredentials && key === "imapUsername") {
        next.smtpUsername = value;
      }
      if (sameSmtpCredentials && key === "imapPassword") {
        next.smtpPassword = value;
      }
      return next;
    });
  }

  function toggleSameCredentials() {
    setSameSmtpCredentials((current) => {
      const next = !current;
      if (!current) {
        setForm((formState) => ({
          ...formState,
          smtpUsername: formState.imapUsername,
          smtpPassword: formState.imapPassword
        }));
      }
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setConnectionError(null);
    try {
      await jsonFetch("/api/accounts", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm((current) => ({ ...current, displayName: "", emailAddress: "", imapUsername: "", imapPassword: "", smtpPassword: "" }));
      onCreated();
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : c.accounts.connectionFailed);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(account: Account) {
    if (!window.confirm(c.accounts.deleteConfirm(account.displayName))) {
      return;
    }

    setDeletingId(account.id);
    setConnectionError(null);
    try {
      await jsonFetch(`/api/accounts/${account.id}`, { method: "DELETE" });
      onCreated();
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : c.accounts.deleteFailed);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <div key={account.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{account.displayName}</p>
              <p className="text-sm text-muted-foreground">{account.emailAddress}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={account.lastSyncError ? "red" : "green"}>{account.lastSyncError ? c.accounts.error : c.accounts.active}</Badge>
              <Button
                type="button"
                size="icon"
                variant="danger"
                title={c.accounts.delete}
                disabled={deletingId === account.id}
                onClick={() => deleteAccount(account)}
              >
                {deletingId === account.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {account.imapHost}:{account.imapPort}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {account.lastSyncAt
              ? `${c.accounts.lastSync}: ${new Date(account.lastSyncAt).toLocaleString()}`
              : c.accounts.neverSynced}
          </p>
          {account.lastSyncError ? <p className="mt-1 text-xs text-red-600 dark:text-red-300">{account.lastSyncError}</p> : null}
        </div>
      ))}

      <form onSubmit={submit} className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2 font-medium">
          <Plus className="h-4 w-4" />
          {c.accounts.add}
        </div>
        {connectionError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {connectionError}
          </div>
        ) : null}
        <div className="grid gap-3">
          <TextField label={c.accounts.displayName} value={form.displayName} onChange={(value) => updateForm("displayName", value)} />
          <TextField label={c.accounts.emailAddress} value={form.emailAddress} onChange={(value) => updateForm("emailAddress", value)} />
          <TextField label="IMAP host" value={form.imapHost} onChange={(value) => updateForm("imapHost", value)} />
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <TextField label="IMAP port" value={form.imapPort} onChange={(value) => updateForm("imapPort", value)} />
            <SecurityField label={c.accounts.security} value={form.imapSecurity} onChange={(value) => updateForm("imapSecurity", value)} />
          </div>
          <TextField label={c.accounts.imapUsername} value={form.imapUsername} onChange={(value) => updateForm("imapUsername", value)} />
          <TextField label={c.accounts.imapPassword} type="password" value={form.imapPassword} onChange={(value) => updateForm("imapPassword", value)} />

          <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-4">
            <div>
              <p className="text-sm font-medium">SMTP</p>
              <p className="text-xs text-muted-foreground">{c.accounts.smtpHint}</p>
            </div>
            <Button type="button" size="sm" variant={sameSmtpCredentials ? "primary" : "secondary"} onClick={toggleSameCredentials}>
              {c.accounts.sameCredentials}
            </Button>
          </div>

          <TextField label="SMTP host" value={form.smtpHost} onChange={(value) => updateForm("smtpHost", value)} />
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <TextField label="SMTP port" value={form.smtpPort} onChange={(value) => updateForm("smtpPort", value)} />
            <SecurityField label={c.accounts.security} value={form.smtpSecurity} onChange={(value) => updateForm("smtpSecurity", value)} />
          </div>
          <TextField
            label={c.accounts.smtpUsername}
            value={form.smtpUsername}
            disabled={sameSmtpCredentials}
            onChange={(value) => updateForm("smtpUsername", value)}
          />
          <TextField
            label={c.accounts.smtpPassword}
            type="password"
            value={form.smtpPassword}
            disabled={sameSmtpCredentials}
            onChange={(value) => updateForm("smtpPassword", value)}
          />
        </div>
        <Button className="mt-4 w-full" variant="primary" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {saving ? c.accounts.checking : c.accounts.checkSave}
        </Button>
      </form>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function SecurityField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary"
      >
        <option value="ssl">SSL/TLS</option>
        <option value="starttls">STARTTLS</option>
        <option value="none">None</option>
      </select>
    </label>
  );
}

function SettingsPanel({
  settings,
  setSettings,
  theme,
  setTheme,
  c,
  language,
  activeCustomCategories
}: {
  settings: AppSettings | null;
  setSettings: (settings: AppSettings) => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => Promise<void>;
  c: AppCopy;
  language: Language;
  activeCustomCategories: { name: string, description: string, excludeFromInbox: boolean }[];
}) {
  const [syncIntervalSecs, setSyncIntervalSecs] = useState(String(settings?.syncIntervalSecs ?? 180));
  const [openaiModel, setOpenaiModel] = useState(settings?.openaiModel ?? "gpt-5.4-mini");
  const [modelOptions, setModelOptions] = useState<OpenAIModelOption[]>([]);
  const [modelsSource, setModelsSource] = useState<"api" | "fallback">("fallback");
  const [openAIKey, setOpenAIKey] = useState(settings?.openAIKey ?? "");
  const [todoistKey, setTodoistKey] = useState(settings?.todoistKey ?? "");

  const [customCategories, setCustomCategories] = useState(activeCustomCategories);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatExclude, setNewCatExclude] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCustomCategories(activeCustomCategories);
  }, [activeCustomCategories]);

  function addCategory() {
    if (!newCatName.trim()) return;
    const snakeName = newCatName.trim().toLowerCase().replace(/\s+/g, '_');
    if (customCategories.some(c => c.name === snakeName)) return;
    setCustomCategories([...customCategories, { name: snakeName, description: newCatDesc.trim(), excludeFromInbox: newCatExclude }]);
    setNewCatName("");
    setNewCatDesc("");
    setNewCatExclude(false);
  }

  function removeCategory(name: string) {
    setCustomCategories(customCategories.filter(c => c.name !== name));
  }

  useEffect(() => {
    if (settings?.syncIntervalSecs) {
      setSyncIntervalSecs(String(settings.syncIntervalSecs));
    }
  }, [settings?.syncIntervalSecs]);

  useEffect(() => {
    if (settings?.openaiModel) {
      setOpenaiModel(settings.openaiModel);
    }
  }, [settings?.openaiModel]);

  useEffect(() => {
    jsonFetch<OpenAIModelsResponse>("/api/ai/models")
      .then((result) => {
        setModelOptions(result.models);
        setModelsSource(result.source);
        setOpenaiModel(settings?.openaiModel ?? result.selected);
      })
      .catch(() => {
        setModelOptions([]);
      });
  }, [settings?.openaiModel]);

  async function updateLanguage(nextLanguage: Language) {
    const updated = await jsonFetch<AppSettings>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ language: nextLanguage })
    });
    setSettings(updated);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await jsonFetch<AppSettings>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          syncIntervalSecs: Number(syncIntervalSecs),
          theme,
          language,
          openaiModel,
          openAIKey: openAIKey.trim() || null,
          todoistKey: todoistKey.trim() || null,
          customCategories: customCategories.map(c => ({ name: c.name, description: c.description || undefined, excludeFromInbox: c.excludeFromInbox || undefined }))
        })
      });
      setSettings(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2 font-medium">
          <Settings className="h-4 w-4" />
          {c.settings.title}
        </div>
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            {c.settings.language}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={language === "de" ? "primary" : "secondary"} onClick={() => updateLanguage("de")}>
                {c.settings.german}
              </Button>
              <Button type="button" variant={language === "en" ? "primary" : "secondary"} onClick={() => updateLanguage("en")}>
                {c.settings.english}
              </Button>
            </div>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            {c.settings.design}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={theme === "light" ? "primary" : "secondary"} onClick={() => setTheme("light")}>
                <Sun className="h-4 w-4" />
                {c.settings.light}
              </Button>
              <Button type="button" variant={theme === "dark" ? "primary" : "secondary"} onClick={() => setTheme("dark")}>
                <Moon className="h-4 w-4" />
                {c.settings.dark}
              </Button>
            </div>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            OpenAI model
            <select
              value={openaiModel}
              onChange={(event) => setOpenaiModel(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            >
              {modelOptions.length ? null : <option value={openaiModel}>{openaiModel}</option>}
              {modelOptions.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.id} - {recommendationLabel(model.recommendation, language)}
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-muted-foreground">
              {modelsSource === "api"
                ? language === "de"
                  ? "Aus deinem OpenAI-Konto geladen."
                  : "Loaded from your OpenAI account."
                : language === "de"
                  ? "Fallback-Liste, falls die OpenAI-Abfrage nicht verfuegbar ist."
                  : "Fallback list if the OpenAI lookup is unavailable."}
            </span>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            {c.settings.openAIKey}
            <input
              type="password"
              value={openAIKey}
              onChange={(event) => setOpenAIKey(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            {c.settings.todoistKey}
            <input
              type="password"
              value={todoistKey}
              onChange={(event) => setTodoistKey(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            {c.settings.syncInterval}
            <input
              value={syncIntervalSecs}
              onChange={(event) => setSyncIntervalSecs(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="grid gap-2 border-t border-border pt-4">
            <label className="text-sm font-medium">{c.settings.customCategories}</label>
            <div className="space-y-2">
              {customCategories.map((cat, idx) => (
                <div key={cat.name} className="flex flex-col gap-2 rounded-md border border-border bg-muted/50 p-2 sm:flex-row sm:items-center">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{cat.name}</div>
                    {cat.description && <div className="truncate text-xs text-muted-foreground">{cat.description}</div>}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={cat.excludeFromInbox}
                      onChange={(e) => {
                        const newCats = [...customCategories];
                        newCats[idx].excludeFromInbox = e.target.checked;
                        setCustomCategories(newCats);
                      }}
                    />
                    {c.settings.excludeFromInbox}
                  </label>
                  <Button type="button" size="icon" variant="secondary" onClick={() => removeCategory(cat.name)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <div className="grid flex-1 gap-2">
                    <input
                      placeholder={c.settings.categoryName}
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
                    />
                    <input
                      placeholder={c.settings.categoryDesc}
                      value={newCatDesc}
                      onChange={(e) => setNewCatDesc(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
                    />
                  </div>
                  <Button type="button" onClick={addCategory} disabled={!newCatName.trim()} className="h-9">
                    <Plus className="mr-1 h-4 w-4" />
                    {c.settings.addCategory}
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={newCatExclude} onChange={(e) => setNewCatExclude(e.target.checked)} />
                  {c.settings.excludeFromInbox}
                </label>
              </div>
            </div>
          </div>
        </div>
        <Button className="mt-4 w-full" variant="primary" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {c.settings.save}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium">{c.settings.state}</p>
        <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between gap-4">
            <dt>{c.settings.lastFolder}</dt>
            <dd>{settings?.lastFolder ?? "Inbox"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>{c.settings.lastView}</dt>
            <dd>{settings?.lastCategory ?? "inbox"}</dd>
          </div>
        </dl>
      </div>
    </form>
  );
}

function TodoPanel({ todos, setTodos, c }: { todos: Todo[]; setTodos: (todos: Todo[]) => void; c: AppCopy }) {
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function update(todo: Todo, status: Todo["status"]) {
    const updated = await jsonFetch<Todo>(`/api/todos/${todo.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    setTodos(todos.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function sendToTodoist(todo: Todo) {
    if (todo.todoistUrl) {
      window.open(todo.todoistUrl, "_blank");
      return;
    }

    setSendingId(todo.id);
    try {
      const response = await jsonFetch<{ success: boolean; url?: string; message?: string; todo?: Todo }>(`/api/todos/${todo.id}/todoist`, { method: "POST" });
      if (response.todo) {
        setTodos(todos.map((item) => (item.id === response.todo!.id ? response.todo! : item)));
      }
      await update(todo, "done");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to send to Todoist");
    } finally {
      setSendingId(null);
    }
  }

  if (!todos.length) {
    return <EmptyInbox hasAccounts c={c} />;
  }

  return (
    <div className="space-y-2">
      {todos.map((todo) => (
        <div key={todo.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <button onClick={() => update(todo, todo.status === "done" ? "open" : "done")} className="mt-0.5">
              <CheckCircle2 className={cn("h-5 w-5", todo.status === "done" ? "text-emerald-500" : "text-muted-foreground")} />
            </button>
            <div className="min-w-0 flex-1">
              <p className={cn("font-medium", todo.status === "done" && "line-through text-muted-foreground")}>{todo.title}</p>
              {todo.description ? <p className="mt-1 text-sm text-muted-foreground">{todo.description}</p> : null}
              {todo.dueDate ? <p className="mt-2 text-xs text-muted-foreground">{new Date(todo.dueDate).toLocaleDateString()}</p> : null}
            </div>
            <div className="flex flex-col gap-2 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
              <Button
                size={todo.todoistId ? "md" : "icon"}
                variant="secondary"
                disabled={sendingId === todo.id}
                onClick={() => sendToTodoist(todo)}
                title={todo.todoistId ? c.openInTodoist : c.sendToTodoist}
                className={cn(todo.todoistId && "border border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/50")}
              >
                {sendingId === todo.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : todo.todoistId ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Todoist
                  </>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyInbox({ hasAccounts, c }: { hasAccounts: boolean; c: AppCopy }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-card/70 p-8 text-center">
      <div>
        <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-medium">{hasAccounts ? c.empty.nothing : c.empty.noAccount}</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          {hasAccounts ? c.empty.syncOrFilter : c.empty.addAccount}
        </p>
      </div>
    </div>
  );
}

function LoadingList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-32 animate-pulse rounded-lg border border-border bg-card" />
      ))}
    </div>
  );
}
