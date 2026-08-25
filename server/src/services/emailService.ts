import nodemailer from "nodemailer";
import { getEmailSettings } from "./emailSettings.js";

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

// The single integration point every email-sending caller goes through.
// Never throws — a failed or disabled email send must never break the
// governance action (finalize, comment, approval, etc.) that triggered it.
export async function sendEmail(to: string, subject: string, html: string): Promise<SendEmailResult> {
  try {
    const settings = await getEmailSettings();

    if (settings.provider === "SMTP") {
      if (!settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword) {
        return { ok: false, error: "SMTP is not fully configured." };
      }
      const transport = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpSecure,
        auth: { user: settings.smtpUser, pass: settings.smtpPassword },
      });
      await transport.sendMail({
        from: `${settings.fromName} <${settings.fromAddress || settings.smtpUser}>`,
        to,
        subject,
        html,
      });
      return { ok: true };
    }

    if (settings.provider === "API") {
      if (!settings.apiKey || !settings.fromAddress) {
        return { ok: false, error: "API key or from address is not configured." };
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${settings.fromName} <${settings.fromAddress}>`,
          to,
          subject,
          html,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, error: `Provider responded ${res.status}: ${body.slice(0, 200)}` };
      }
      return { ok: true };
    }

    // provider === "DISABLED" (or unset) — no-op.
    return { ok: false, error: "Email is disabled." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error sending email." };
  }
}
