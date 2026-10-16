import type { Metadata } from "next";
import Link from "next/link";
import { ScanCardButton } from "@/components/staff/ScanCardButton";
import { StaffCardPanel } from "@/components/staff/StaffCardPanel";
import { ServiceError } from "@/server/http";
import { firstParam } from "@/server/request";
import { currentStaffDevice, viewCard } from "@/server/services/staff";

export const metadata: Metadata = { title: "Stamp card" };

/** Opened by scanning a guest's card QR (`/staff/stamp?c=<card id>`) on a paired device. */
export default async function StaffStampPage({ searchParams }: PageProps<"/staff/stamp">) {
  const params = await searchParams;
  const cardId = firstParam(params.c);
  const joined = firstParam(params.joined);
  const device = await currentStaffDevice();
  if (!device) {
    return (
      <section className="till-message">
        <h1>This isn&apos;t a staff device</h1>
        <p>Only the venue&apos;s paired till devices can add stamps. If you&apos;re a guest, show this code to a member of staff.</p>
      </section>
    );
  }

  let view;
  try {
    view = await viewCard(device, cardId);
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    return (
      <section className="till-message">
        <h1>Can&apos;t open this card</h1>
        <p>{error.message}</p>
        <ScanCardButton label="Scan another card" />
        <Link className="staff-btn staff-btn-secondary" href="/staff">
          Back
        </Link>
      </section>
    );
  }

  return (
    <>
      {joined === "new" && <div className="notice notice-ok">Member added. Their card is on its way to their email.</div>}
      {joined === "existing" && <div className="notice notice-ok">They&apos;re already a member: here&apos;s their card. We&apos;ve emailed it to them again.</div>}
      <StaffCardPanel key={view.cardId} initial={view} />
    </>
  );
}
