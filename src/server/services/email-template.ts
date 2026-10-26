import "server-only";

/**
 * One layout for every email: who it's from at the top, a heading, short
 * paragraphs, at most one button, small print and a footer. Rendered twice
 * from the same content: HTML for mail apps (tables and inline styles,
 * which is what Gmail, Outlook and Apple Mail all agree on) and plain text
 * for the rest, which is also what the outbox keeps.
 */

export interface EmailLink {
  label: string;
  url: string;
}

export interface EmailContent {
  /** The name at the top: the venue for its members' emails, Tapmore for owners'. */
  brand: string;
  /** The inbox preview line (hidden in the email itself). */
  preheader?: string;
  heading: string;
  /** "Hi Priya," above the paragraphs. */
  greeting?: string;
  paragraphs: string[];
  button?: EmailLink;
  /** Smaller paragraphs under the button: how long a link works, what to do if it wasn't you. */
  notes?: string[];
  /** Grey lines under the card, e.g. why they're getting it; links follow on their own line. */
  footer?: string[];
  footerLinks?: EmailLink[];
}

const COLORS = {
  page: "#F4F2EE",
  card: "#FFFFFF",
  border: "#E6E2DA",
  ink: "#1C1B19",
  text: "#3A3833",
  muted: "#7A766D",
  accent: "#24573F",
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function paragraph(text: string, size: number, color: string, margin = "0 0 14px"): string {
  return `<p style="margin:${margin};font-family:${FONT};font-size:${size}px;line-height:1.55;color:${color};">${escape(text)}</p>`;
}

export function renderEmail(content: EmailContent): { text: string; html: string } {
  return { text: renderText(content), html: renderHtml(content) };
}

function renderText(content: EmailContent): string {
  const lines: string[] = [];
  if (content.greeting) lines.push(content.greeting, "");
  lines.push(content.heading, "");
  for (const p of content.paragraphs) lines.push(p, "");
  if (content.button) lines.push(`${content.button.label}:`, content.button.url, "");
  for (const note of content.notes ?? []) lines.push(note, "");
  lines.push("—");
  for (const line of content.footer ?? []) lines.push(line);
  for (const link of content.footerLinks ?? []) lines.push(`${link.label}: ${link.url}`);
  lines.push(content.brand);
  return lines.join("\n");
}

function renderHtml(content: EmailContent): string {
  const button = content.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;">
          <tr><td style="border-radius:10px;background:${COLORS.accent};">
            <a href="${escape(content.button.url)}" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">${escape(content.button.label)}</a>
          </td></tr>
        </table>`
    : "";
  // The raw link too, small, for mail apps that block buttons.
  const fallback = content.button
    ? `<p style="margin:0 0 14px;font-family:${FONT};font-size:12px;line-height:1.5;color:${COLORS.muted};">Button not working? Open this link:<br><a href="${escape(content.button.url)}" style="color:${COLORS.muted};word-break:break-all;">${escape(content.button.url)}</a></p>`
    : "";
  const footerLinks = (content.footerLinks ?? [])
    .map((link) => `<a href="${escape(link.url)}" style="color:${COLORS.muted};text-decoration:underline;">${escape(link.label)}</a>`)
    .join(" &nbsp;·&nbsp; ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escape(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};">
${content.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escape(content.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">
  <tr><td align="center" style="padding:28px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td style="padding:0 6px 14px;font-family:${FONT};font-size:16px;font-weight:700;color:${COLORS.ink};">${escape(content.brand)}</td></tr>
      <tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;padding:28px 26px 14px;">
        ${content.greeting ? paragraph(content.greeting, 15, COLORS.text, "0 0 6px") : ""}
        <h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${COLORS.ink};">${escape(content.heading)}</h1>
        ${content.paragraphs.map((p) => paragraph(p, 15, COLORS.text)).join("\n        ")}
        ${button}
        ${fallback}
        ${(content.notes ?? []).map((note) => paragraph(note, 13, COLORS.muted)).join("\n        ")}
      </td></tr>
      <tr><td style="padding:16px 6px 0;">
        ${(content.footer ?? []).map((line) => paragraph(line, 12, COLORS.muted, "0 0 6px")).join("\n        ")}
        ${footerLinks ? `<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.5;color:${COLORS.muted};">${footerLinks}</p>` : ""}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
