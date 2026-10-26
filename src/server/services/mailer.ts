import "server-only";
import { BRAND } from "@/config/brand";
import { getDb } from "../db";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  /** The same message laid out for mail apps (see email-template); the outbox keeps the text. */
  html?: string;
  /** The sender's display name, e.g. "Juniper" on a venue's member emails; the address stays MAIL_FROM's. */
  fromName?: string;
  /** Extra headers, e.g. List-Unsubscribe on marketing email. */
  headers?: Record<string, string>;
}

/** MAIL_FROM with another display name: "Juniper <noreply@tapmore.in>". */
export function senderWithName(from: string, name: string | undefined): string {
  if (!name) return from;
  const address = /<([^>]+)>/.exec(from)?.[1] ?? from.trim();
  // Quotes, angle brackets and line breaks would break the header.
  const safe = name.replace(/["<>\r\n\\]/g, "").trim().slice(0, 70);
  return safe ? `"${safe}" <${address}>` : from;
}

/** How long a send may wait for the provider before it counts as failed. */
const SEND_TIMEOUT_MS = 10_000;

/**
 * Link tokens (password reset, card, consent, staff invite) blanked out, so
 * the outbox, kept as an audit trail, never holds a working private link.
 */
export function redactLinks(text: string): string {
  return text.replace(/([?&](?:token|t)=)[^\s&]+/g, "$1[redacted]");
}

/**
 * Every message is written to the `outbox` table. Without RESEND_API_KEY
 * (development) that is the whole delivery, with the links intact so they
 * can be copied from there or the server log. With it, the message goes
 * through Resend, the outbox keeps it with its links blanked out, and the
 * answer says whether Resend accepted it, so callers can retry or record
 * a failure honestly.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  let outboxId: number | null = null;
  try {
    const row = await (await getDb()).get<{ id: number }>(
      "INSERT INTO outbox (recipient, subject, body, status) VALUES (?, ?, ?, ?) RETURNING id",
      mail.to,
      mail.subject,
      apiKey ? redactLinks(mail.text) : mail.text,
      apiKey ? "sending" : "logged",
    );
    outboxId = row?.id ?? null;
  } catch (error) {
    console.error("[mail] couldn't record", error);
    return false;
  }
  if (!apiKey) {
    console.info(`[mail] from=${senderWithName(BRAND.emailFrom, mail.fromName)} to=${mail.to} subject="${mail.subject}"\n${mail.text}\n`);
    return true;
  }
  let ok = false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: senderWithName(BRAND.emailFrom, mail.fromName),
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
        headers: mail.headers,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    ok = response.ok;
    if (!ok) console.error(`[mail] Resend ${response.status} for "${mail.subject}": ${await response.text()}`);
  } catch (error) {
    console.error("[mail] Resend unreachable", error);
  }
  if (outboxId !== null) {
    await (await getDb()).run("UPDATE outbox SET status = ? WHERE id = ?", ok ? "sent" : "failed", outboxId).catch(() => {});
  }
  return ok;
}
