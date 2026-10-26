import { describe, expect, it } from "vitest";
import { renderEmail } from "./services/email-template";
import { senderWithName } from "./services/mailer";

describe("email layout", () => {
  const content = {
    brand: "Juniper <Coffee> & Co",
    preheader: "Your card is ready.",
    greeting: "Hi Priya,",
    heading: "Your Juniper card",
    paragraphs: ["Show it at the counter."],
    button: { label: "Open my card", url: "https://tapmore.test/card/crd_1?t=abc&s=1" },
    notes: ["Delete it any time."],
    footer: ["Juniper · via Tapmore"],
    footerLinks: [{ label: "Unsubscribe", url: "https://tapmore.test/unsubscribe?token=xyz" }],
  };

  it("lays the same message out as HTML and as plain text", () => {
    const { html, text } = renderEmail(content);
    expect(html).toContain("<h1");
    expect(html).toContain('href="https://tapmore.test/card/crd_1?t=abc&amp;s=1"');
    expect(html).toContain(">Open my card</a>");
    expect(text).toContain("Hi Priya,");
    expect(text).toContain("Open my card:\nhttps://tapmore.test/card/crd_1?t=abc&s=1");
    expect(text).toContain("Unsubscribe: https://tapmore.test/unsubscribe?token=xyz");
  });

  it("escapes names and text, so a venue name can't inject markup", () => {
    const { html } = renderEmail({ ...content, paragraphs: ['<img src=x onerror="alert(1)">'] });
    expect(html).toContain("Juniper &lt;Coffee&gt; &amp; Co");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<Coffee>");
  });
});

describe("sender name", () => {
  it("keeps MAIL_FROM's address and swaps the display name safely", () => {
    expect(senderWithName("Tapmore <noreply@tapmore.in>", "Juniper via Tapmore")).toBe('"Juniper via Tapmore" <noreply@tapmore.in>');
    expect(senderWithName("Tapmore <noreply@tapmore.in>", 'Evil" <x@y.z>\r\nBcc: a@b.c')).toBe('"Evil x@y.zBcc: a@b.c" <noreply@tapmore.in>');
    expect(senderWithName("Tapmore <noreply@tapmore.in>", undefined)).toBe("Tapmore <noreply@tapmore.in>");
  });
});
