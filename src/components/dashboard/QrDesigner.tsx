"use client";

import { Download, Nfc, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { sourceSlug } from "@/lib/qr-source";
import { PRINT_FORMATS, PrintSheets, parseTables, printFormats, sheetCount, type PrintFormat, type PrintVenue } from "./PrintSheets";
import { Card, CopyButton, Field, HelpTip, SwitchRow } from "./ui";

const COLORS = ["#000000", "#1F2A24", "#2F4A3A", "#1C2541", "#7A2E2E"];

/** `value` once it has stopped changing for `ms`: typing or dragging the colour picker fetches one image, not dozens. */
function useSettled<T>(value: T, ms = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

export function QrDesigner({ venueId, guestUrl, printVenue }: { venueId: string; guestUrl: string; printVenue: PrintVenue }) {
  // Compiled by the React Compiler (annotation mode, see next.config): re-renders only what an edit touches.
  "use memo";
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#000000");
  // A café numbers a card per table ("Table 1"…); a shop usually wants the same card a few times, unnumbered.
  const [numbered, setNumbered] = useState(printVenue.food);
  const [tables, setTables] = useState("1-10");
  const [format, setFormat] = useState<PrintFormat>("a6");
  // Unnumbered copies: a full sheet of the chosen format until the owner picks a number.
  const [copiesEdit, setCopies] = useState<number | null>(null);
  const copies = copiesEdit ?? PRINT_FORMATS[format].perPage;
  const cardLabels = (input: string) => (numbered ? parseTables(input, printVenue.spot) : Array.from({ length: copies }, () => ""));
  const labels = cardLabels(tables);
  const sheets = sheetCount(format, labels.length);
  const source = sourceSlug(label);
  const qrUrl = (s: string, c: string) => `/api/dashboard/venues/${venueId}/qr?${new URLSearchParams({ ...(s ? { s } : {}), color: c })}`;
  // Downloads use exactly what's in the fields; the on-screen codes follow once typing pauses.
  const qrBase = qrUrl(source, color);
  const settledSource = useSettled(source);
  const settledColor = useSettled(color);
  const settledTables = useSettled(tables);
  const sheetLabels = cardLabels(settledTables);
  const link = source ? `${guestUrl}&s=${source}` : guestUrl;

  return (
    <>
      <div className="qr-grid no-print">
        <Card title="Download a code" description="Print it on table cards, the counter, bills, bags or the window.">
          <div className="qr-download">
            <div>
              <Field label="Where will this code go? (optional)" htmlFor="qr-label" hint={source ? `Scans will show as “${source}” in your stats.` : `Name it to see which spot gets the most scans, e.g. “${printVenue.spot} 2” or “Window”.`}>
                <input id="qr-label" className="input" enterKeyHint="done" value={label} onChange={(event) => setLabel(event.target.value)} placeholder={`${printVenue.spot} 2`} maxLength={60} />
              </Field>
              <div className="field" style={{ marginTop: 14 }}>
                <span className="field-label">Colour</span>
                <div className="swatches">
                  {COLORS.map((c) => (
                    <button key={c} type="button" className="swatch" style={{ background: c }} aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)} />
                  ))}
                  <input className="color-input" type="color" aria-label="Custom colour" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} />
                </div>
                <p className="hint">Keep it dark on white so every phone can scan it.</p>
              </div>
            </div>
            {/* The code itself, small: it updates as the name and colour change. */}
            <div className="qr-frame">
              {/* eslint-disable-next-line @next/next/no-img-element -- generated on demand, auth-gated */}
              <img src={qrUrl(settledSource, settledColor)} alt={`QR code linking to ${link}`} />
            </div>
          </div>
          <div className="share-link" style={{ marginTop: 14 }}>
            <code>{link}</code>
            <CopyButton text={link} />
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            Share the link too: your Instagram bio, WhatsApp status or Google profile. Name it “Instagram” above to see those visits in your stats.
          </p>
          <div className="inline" style={{ marginTop: 16 }}>
            <a className="btn btn-primary" href={`${qrBase}&format=png&size=2048&download=1`}>
              <Download aria-hidden /> PNG (print)
            </a>
            <a className="btn" href={`${qrBase}&format=svg&download=1`}>
              <Download aria-hidden /> SVG (designers)
            </a>
          </div>
        </Card>

        <Card
          id="table-cards"
          title={printVenue.food ? "Table cards" : "QR cards"}
          description={`Cards, stickers${printVenue.wifi ? " and Wi-Fi signs" : ""} with your code, in your colours. Print them straight from here.`}
        >
          <div className="field">
            <span className="field-label" id="print-format-label">
              Format
            </span>
            <div className="segmented print-format-pick" role="group" aria-labelledby="print-format-label">
              {printFormats(printVenue).map((f) => (
                <button key={f} type="button" aria-pressed={format === f} onClick={() => setFormat(f)}>
                  {PRINT_FORMATS[f].label}
                </button>
              ))}
            </div>
            <p className="hint">{PRINT_FORMATS[format].hint}</p>
          </div>
          {format !== "wifi" && (
            <>
              <SwitchRow
                title={`Number each card (${printVenue.spot} 1, ${printVenue.spot} 2…)`}
                description={`Shows which ${printVenue.spot.toLowerCase()} gets the most scans. Off: every card is the same.`}
                checked={numbered}
                onChange={setNumbered}
              />
              {numbered ? (
                <Field label={`Which ${printVenue.spot.toLowerCase()}s?`} htmlFor="qr-tables" hint={printVenue.food ? "A range like 1-12, or a list like 1, 2, 5, Patio." : "A range like 1-3, or a list like 1, 2, Billing, Entrance."}>
                  <input id="qr-tables" className="input" enterKeyHint="done" value={tables} onChange={(event) => setTables(event.target.value)} maxLength={200} />
                </Field>
              ) : (
                <Field label="How many cards?" htmlFor="qr-copies">
                  <input
                    id="qr-copies"
                    className="input qr-copies"
                    type="number"
                    min={1}
                    max={100}
                    value={copies}
                    onChange={(event) => setCopies(Math.min(100, Math.max(1, Number(event.target.value) || 1)))}
                  />
                </Field>
              )}
            </>
          )}
          <div className="inline" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={(format !== "wifi" && labels.length === 0) || settledTables !== tables || settledColor !== color}>
              <Printer aria-hidden /> Print {sheets} sheet{sheets === 1 ? "" : "s"}
            </button>
            {format !== "wifi" && numbered && (
              <button type="button" className="btn" onClick={() => downloadNfcLinks(printVenue.name, guestUrl, labels, printVenue.spot)} disabled={labels.length === 0}>
                <Nfc aria-hidden /> NFC links
              </button>
            )}
            <span className="hint">A4, scale 100%</span>
          </div>
          <HelpTip question="How do I print them the right size?">
            <p>
              In the print window choose <strong>A4</strong> paper and set the scale to <strong>100%</strong> (sometimes called &ldquo;Actual size&rdquo;). Turn off &ldquo;Fit to page&rdquo;, or the codes print too small to
              scan easily. Thick card (250gsm or more) stands up best in holders.
            </p>
          </HelpTip>
          {format !== "wifi" && numbered && (
            <HelpTip question="How do I write the NFC tags?">
              <ol>
                <li>
                  Tap <strong>NFC links</strong> to download every code&apos;s link (a spreadsheet: each NFC link beside its QR link).
                </li>
                <li>
                  In the free <strong>NFC Tools</strong> app: <strong>Write → Add a record → URL</strong>, paste that spot&apos;s NFC link, tap{" "}
                  <strong>Write</strong> and hold the phone on an NTAG213/215 tag.
                </li>
                <li>Test it with another phone, then lock the tag (<strong>Other → Lock tag</strong>) so nobody can rewrite it.</li>
              </ol>
              <p>Taps count towards the same spot as its QR code. Keep the QR code beside the tag too.</p>
              {isTemporaryAddress(guestUrl) && (
                <p>
                  <strong>Write tags only from your live site:</strong> these links use a temporary address ({new URL(guestUrl).host}).
                </p>
              )}
            </HelpTip>
          )}
        </Card>
      </div>
      <section className="qr-sheet-preview" aria-label="Print preview">
        <p className="preview-label no-print">
          Preview{sheets > 1 ? ` · sheet 1 of ${sheets}` : ""}
        </p>
        <PrintSheets venue={printVenue} labels={sheetLabels} color={settledColor} format={format} />
      </section>
    </>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()}>
      <Printer aria-hidden /> Print
    </button>
  );
}

/** A link an NFC tag can carry: the spot's page, marked so taps show apart from scans in the stats ("table-4-nfc", or "nfc" unnamed). */
export function nfcTagLink(guestUrl: string, label: string): string {
  const spot = sourceSlug(label);
  return `${guestUrl}&s=${spot ? `${spot}-nfc` : "nfc"}`;
}

/** Addresses a printed tag must never carry: they stop working once the app moves to its real domain. */
function isTemporaryAddress(url: string): boolean {
  return /^https?:\/\/(localhost|127\.|192\.168\.|10\.|[^/]*ngrok)/i.test(url);
}

/** One CSV cell, quoted when it holds a comma, quote or line break. */
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Downloads every table's links as a spreadsheet (CSV): the NFC link to write
 * onto its tag next to the QR link printed on its card, so each table's tag
 * and card match.
 */
export function nfcLinksCsv(guestUrl: string, labels: string[], spot = "Table"): string {
  const rows = [[spot, "NFC link (write onto the tag)", "QR link (on the printed card)"]];
  for (const label of labels) rows.push([label, nfcTagLink(guestUrl, label), `${guestUrl}&s=${sourceSlug(label)}`]);
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function downloadNfcLinks(venueName: string, guestUrl: string, labels: string[], spot: string) {
  const blob = new Blob([nfcLinksCsv(guestUrl, labels, spot)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sourceSlug(venueName) || "venue"}-nfc-links.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
