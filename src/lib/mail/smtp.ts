import nodemailer from "nodemailer";
import type { MailAccount } from "@prisma/client";
import { decryptSecret } from "@/lib/security/encryption";

type SmtpConnectionSettings = {
  host: string;
  port: number;
  security?: string | null;
  username: string;
  password: string;
};

function createSmtpTransportFromSettings(settings: SmtpConnectionSettings) {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.security === "ssl" || settings.security === "tls",
    requireTLS: settings.security === "starttls",
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: settings.username,
      pass: settings.password
    }
  });
}

export function createSmtpTransport(account: MailAccount) {
  if (!account.smtpHost || !account.smtpPort || !account.smtpUsername || !account.smtpPasswordEncrypted) {
    throw new Error("SMTP settings are incomplete for this account.");
  }

  return createSmtpTransportFromSettings({
    host: account.smtpHost,
    port: account.smtpPort,
    security: account.smtpSecurity,
    username: account.smtpUsername,
    password: decryptSecret(account.smtpPasswordEncrypted)
  });
}

export async function validateSmtpConnection(settings: SmtpConnectionSettings) {
  const transport = createSmtpTransportFromSettings(settings);

  try {
    await transport.verify();
  } finally {
    transport.close();
  }
}
