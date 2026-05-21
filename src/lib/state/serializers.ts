import type { Email, EmailAnalysis, MailAccount, Todo, UserSettings } from "@prisma/client";

export function serializeAccount(account: MailAccount) {
  return {
    id: account.id,
    displayName: account.displayName,
    emailAddress: account.emailAddress,
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    imapSecurity: account.imapSecurity,
    imapUsername: account.imapUsername,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    smtpSecurity: account.smtpSecurity,
    smtpUsername: account.smtpUsername,
    isEnabled: account.isEnabled,
    lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
    lastSyncError: account.lastSyncError,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString()
  };
}

export function serializeEmail(
  email: Email & { analysis?: EmailAnalysis | null; todos?: Todo[] }
) {
  return {
    ...email,
    imapUid: email.imapUid?.toString() ?? null,
    date: email.date.toISOString(),
    createdAt: email.createdAt.toISOString(),
    updatedAt: email.updatedAt.toISOString(),
    analysis: email.analysis
      ? {
          ...email.analysis,
          todoDueDate: email.analysis.todoDueDate?.toISOString() ?? null,
          createdAt: email.analysis.createdAt.toISOString()
        }
      : null,
    todos: email.todos?.map(serializeTodo) ?? []
  };
}

export function serializeTodo(todo: Todo) {
  return {
    ...todo,
    dueDate: todo.dueDate?.toISOString() ?? null,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString()
  };
}

export function serializeSettings(settings: UserSettings | null) {
  if (!settings) return null;
  return {
    ...settings,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString()
  };
}
