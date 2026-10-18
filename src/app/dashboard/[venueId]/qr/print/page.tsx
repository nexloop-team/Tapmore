import type { Metadata } from "next";
import Link from "next/link";
import { PrintSheets, PRINT_FORMATS, isPrintFormat, parseTables, printVenue, type PrintFormat } from "@/components/dashboard/PrintSheets";
import { PrintButton } from "@/components/dashboard/QrDesigner";
import { loadDashboardVenue } from "@/server/dashboard";
import { firstParam } from "@/server/request";

export const metadata: Metadata = { title: "Print table cards" };

/** Full-page print sheet (the QR page prints in place too; this stays for old links and big runs). */
export default async function PrintPage({ params, searchParams }: PageProps<"/dashboard/[venueId]/qr/print">) {
  const { venue } = await loadDashboardVenue((await params).venueId);
  const query = await searchParams;
  const tablesParam = firstParam(query.tables) || "1-10";
  const labels = parseTables(tablesParam);
  const color = /^#[0-9a-fA-F]{6}$/.test(firstParam(query.color)) ? firstParam(query.color) : "#000000";
  const requested = firstParam(query.f);
  const format: PrintFormat = isPrintFormat(requested) ? requested : "a6";
  const href = (f: PrintFormat) => `/dashboard/${venue.id}/qr/print?${new URLSearchParams({ tables: tablesParam, color, f })}`;

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>Table cards</h1>
          <p>{PRINT_FORMATS[format].hint} Print at 100%.</p>
        </div>
        <div className="inline">
          <Link className="btn" href={`/dashboard/${venue.id}/qr`}>
            Back
          </Link>
          <PrintButton />
        </div>
      </div>
      <nav className="segmented print-formats no-print" aria-label="Card format">
        {(Object.keys(PRINT_FORMATS) as PrintFormat[]).map((f) => (
          <Link key={f} href={href(f)} aria-current={f === format ? "true" : undefined}>
            {PRINT_FORMATS[f].label}
          </Link>
        ))}
      </nav>
      <PrintSheets venue={printVenue(venue.id, venue.config)} labels={labels} color={color} format={format} />
    </>
  );
}
