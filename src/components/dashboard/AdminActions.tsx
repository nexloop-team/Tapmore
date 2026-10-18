"use client";

import { Ban, CalendarPlus, CreditCard, ExternalLink, Gift, KeyRound, LayoutDashboard, Loader2, Lock, LockOpen, Mail, MoreHorizontal, RotateCcw, Shield, ShieldOff, Trash2, XCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type ReactNode, type ToggleEvent } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import type { AdminUserRequest, AdminVenueRequest } from "@/lib/api/account-contracts";
import type { VenueSegment } from "@/server/admin";
import { useConfirm, type ConfirmOptions } from "./confirm";
import { useToast } from "./toast";

const TRIAL_EXTENSION_DAYS = 7;

/** One entry in a row's "…" menu: a link, or an action that asks first. */
type MenuEntry =
  | { kind: "link"; label: string; icon: LucideIcon; href: string; external?: boolean }
  | { kind: "action"; label: string; icon: LucideIcon; danger?: boolean; run: () => Promise<unknown>; question: ConfirmOptions | (() => ConfirmOptions); done?: string }
  | { kind: "separator" };

/**
 * A row's "…" menu. It lives in the top layer (so the scrolling table can't
 * clip it), pinned under the trigger and flipping up near the bottom. Every
 * action asks first, then refreshes the page.
 */
function RowMenu({ label, lead, entries }: { label: string; lead?: ReactNode; entries: (MenuEntry | false)[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const onScroll = useRef<(() => void) | null>(null);

  function place() {
    const box = trigger.current?.getBoundingClientRect();
    const el = menu.current;
    if (!box || !el) return;
    const below = box.bottom + 4 + el.offsetHeight <= window.innerHeight;
    el.style.top = `${below ? box.bottom + 4 : Math.max(8, box.top - 4 - el.offsetHeight)}px`;
    el.style.left = `${Math.max(8, Math.min(box.right - el.offsetWidth, window.innerWidth - el.offsetWidth - 8))}px`;
  }

  function onToggle(event: ToggleEvent<HTMLDivElement>) {
    if (event.newState === "open") {
      place();
      onScroll.current = () => menu.current?.hidePopover();
      window.addEventListener("scroll", onScroll.current, { capture: true, passive: true });
      window.addEventListener("resize", onScroll.current, { passive: true });
    } else if (onScroll.current) {
      window.removeEventListener("scroll", onScroll.current, { capture: true });
      window.removeEventListener("resize", onScroll.current);
      onScroll.current = null;
    }
  }

  async function choose(entry: Extract<MenuEntry, { kind: "action" }>) {
    menu.current?.hidePopover();
    if (!(await confirm(typeof entry.question === "function" ? entry.question() : entry.question))) return;
    setPending(true);
    setError(null);
    try {
      await entry.run();
      if (entry.done) toast({ text: entry.done });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="row-actions">
      <div className="inline nowrap">
        {lead}
        <button ref={trigger} type="button" className="btn btn-sm btn-icon" popoverTarget={menuId} aria-label={label} disabled={pending}>
          {pending ? <Loader2 className="spin" aria-hidden /> : <MoreHorizontal aria-hidden />}
        </button>
      </div>
      <div ref={menu} id={menuId} popover="auto" className="menu" onToggle={onToggle}>
        {entries.map((entry, i) => {
          if (!entry) return null;
          if (entry.kind === "separator") return <div key={i} className="menu-sep" role="separator" />;
          const Icon = entry.icon;
          if (entry.kind === "link")
            return entry.external ? (
              <a key={i} className="menu-item" href={entry.href} target="_blank" rel="noreferrer">
                <Icon aria-hidden /> {entry.label}
              </a>
            ) : (
              <Link key={i} className="menu-item" href={entry.href}>
                <Icon aria-hidden /> {entry.label}
              </Link>
            );
          return (
            <button key={i} type="button" className={`menu-item${entry.danger ? " danger" : ""}`} onClick={() => void choose(entry)}>
              <Icon aria-hidden /> {entry.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Row actions for a venue: open it, subscription and status changes, and deleting it for the owner. */
export function AdminVenueActions({
  venueId,
  name,
  guestUrl,
  status,
  segment,
  renewing = false,
}: {
  venueId: string;
  name: string;
  guestUrl: string;
  status: "active" | "suspended";
  segment: VenueSegment;
  /** Pays through a subscription that will renew, so renewal can be cancelled. */
  renewing?: boolean;
}) {
  const update = (body: AdminVenueRequest) => () => dashboardApi.adminUpdateVenue(venueId, body);
  const onTrial = segment === "trial" || segment === "unpaid";
  const typed = useRef("");
  const confirmId = useId();
  return (
    <RowMenu
      label={`More actions for ${name}`}
      lead={
        <Link className="btn btn-sm" href={`/dashboard/${venueId}`} title="View as owner (read-only)" aria-label={`View ${name} as owner (read-only)`}>
          View
        </Link>
      }
      entries={[
        { kind: "link", label: "View as owner (read-only)", icon: LayoutDashboard, href: `/dashboard/${venueId}` },
        { kind: "link", label: "View guest page", icon: ExternalLink, href: guestUrl, external: true },
        { kind: "separator" },
        segment === "free" && {
          kind: "action",
          label: "Remove free access",
          icon: XCircle,
          run: update({ freeAccess: false }),
          question: {
            title: `Remove free access from ${name}?`,
            body: "Unless it subscribes or still has trial days left, its guest page goes offline straight away.",
            confirmLabel: "Remove access",
            danger: true,
          },
        },
        onTrial && {
          kind: "action",
          label: `Extend trial by ${TRIAL_EXTENSION_DAYS} days`,
          icon: CalendarPlus,
          run: update({ extendTrialDays: TRIAL_EXTENSION_DAYS }),
          question: {
            title: `Give ${name} ${TRIAL_EXTENSION_DAYS} more trial days?`,
            body: segment === "unpaid" ? "Its trial restarts from today, so the guest page comes back online now." : "They're added to the end of the current trial.",
            confirmLabel: "Extend trial",
          },
          done: "Trial extended.",
        },
        onTrial && {
          kind: "action",
          label: "Give free access",
          icon: Gift,
          run: update({ freeAccess: true }),
          question: { title: `Give ${name} free access?`, body: "Every feature stays on with no charge until you remove it.", confirmLabel: "Give free access" },
        },
        status === "active"
          ? {
              kind: "action",
              label: "Suspend venue",
              icon: Ban,
              danger: true,
              run: update({ status: "suspended" }),
              question: { title: `Suspend ${name}?`, body: "Its guest page goes offline for every QR code until you restore it.", confirmLabel: "Suspend venue", danger: true },
            }
          : {
              kind: "action",
              label: "Restore venue",
              icon: RotateCcw,
              run: update({ status: "active" }),
              question: { title: `Restore ${name}?`, body: "Its guest page comes back online straight away.", confirmLabel: "Restore venue" },
            },
        renewing && {
          kind: "action",
          label: "Cancel renewal",
          icon: CreditCard,
          danger: true,
          run: update({ cancelRenewal: true }),
          question: {
            title: `Cancel ${name}'s renewal?`,
            body: "It won't be charged again. The guest page stays live until the end of the year they paid for, then goes offline.",
            confirmLabel: "Cancel renewal",
            cancelLabel: "Keep renewing",
            danger: true,
          },
          done: "Renewal cancelled.",
        },
        { kind: "separator" },
        {
          kind: "action",
          label: "Delete venue",
          icon: Trash2,
          danger: true,
          run: () => dashboardApi.adminDeleteVenue(venueId, { confirmName: typed.current }),
          question: () => {
            typed.current = "";
            return {
              title: `Delete ${name}?`,
              body: (
                <>
                  <p>
                    This deletes the guest page, menus, guests, feedback and photos for good, and stops its Razorpay subscription. Printed QR codes stop
                    working. It can&apos;t be undone.
                  </p>
                  <label className="field-label" htmlFor={confirmId} style={{ display: "block", marginTop: 10 }}>
                    Type the venue&apos;s name to confirm
                  </label>
                  <input id={confirmId} className="input" autoComplete="off" onChange={(event) => (typed.current = event.target.value)} />
                </>
              ),
              confirmLabel: "Delete venue",
              danger: true,
            };
          },
          done: "Venue deleted.",
        },
      ]}
    />
  );
}

/** Row actions for an account: emails, block or unblock, delete. */
export function AdminUserActions({
  userId,
  email,
  verified,
  blocked,
  protectedAccount,
  canManageAdmins,
  adminRole,
}: {
  userId: string;
  email: string;
  verified: boolean;
  blocked: boolean;
  protectedAccount: boolean;
  /** Only super admins (ADMIN_EMAILS) can make or remove admins. */
  canManageAdmins: boolean;
  adminRole: boolean;
}) {
  const typed = useRef("");
  const confirmId = useId();
  const update = (action: AdminUserRequest["action"]) => () => dashboardApi.adminUpdateUser(userId, { action });
  return (
    <RowMenu
      label={`Actions for ${email}`}
      entries={[
        !verified && {
          kind: "action",
          label: "Resend confirmation email",
          icon: Mail,
          run: update("resend_verification"),
          question: { title: `Resend the confirmation email to ${email}?`, confirmLabel: "Resend" },
          done: "Confirmation email sent.",
        },
        !blocked && {
          kind: "action",
          label: "Send password reset link",
          icon: KeyRound,
          run: update("send_reset"),
          question: {
            title: `Email ${email} a password reset link?`,
            body: "The link goes to their inbox only and works for an hour. Their password doesn't change until they use it.",
            confirmLabel: "Send link",
          },
          done: "Password reset link sent.",
        },
        canManageAdmins && { kind: "separator" },
        canManageAdmins &&
          (adminRole
            ? {
                kind: "action",
                label: "Remove admin",
                icon: ShieldOff,
                run: update("remove_admin"),
                question: { title: `Remove ${email} as an admin?`, body: "They lose access to the admin console straight away.", confirmLabel: "Remove admin", danger: true },
                done: "Admin removed.",
              }
            : {
                kind: "action",
                label: "Make admin",
                icon: Shield,
                run: update("make_admin"),
                question: {
                  title: `Make ${email} an admin?`,
                  body: "They can see every venue and account, suspend venues, extend trials and block accounts. Every change they make is logged.",
                  confirmLabel: "Make admin",
                },
                done: "Admin added.",
              }),
        !protectedAccount && { kind: "separator" },
        !protectedAccount &&
          (blocked
            ? {
                kind: "action",
                label: "Unblock account",
                icon: LockOpen,
                run: update("unblock"),
                question: { title: `Unblock ${email}?`, body: "They can sign in again.", confirmLabel: "Unblock" },
                done: "Account unblocked.",
              }
            : {
                kind: "action",
                label: "Block account",
                icon: Lock,
                danger: true,
                run: update("block"),
                question: {
                  title: `Block ${email}?`,
                  body: "They're signed out everywhere and can't sign in, and tills opened from their login stop working. Their venues stay online; suspend those separately if you need to.",
                  confirmLabel: "Block account",
                  danger: true,
                },
                done: "Account blocked.",
              }),
        !protectedAccount && {
          kind: "action",
          label: "Delete account",
          icon: Trash2,
          danger: true,
          run: () => dashboardApi.adminDeleteUser(userId, { confirmEmail: typed.current }),
          question: () => {
            typed.current = "";
            return {
              title: `Delete ${email}?`,
              body: (
                <>
                  <p>This deletes the account and every venue only they own, with its guests and feedback. It can&apos;t be undone.</p>
                  <label className="field-label" htmlFor={confirmId} style={{ display: "block", marginTop: 10 }}>
                    Type their email to confirm
                  </label>
                  <input id={confirmId} className="input" type="email" autoComplete="off" onChange={(event) => (typed.current = event.target.value)} />
                </>
              ),
              confirmLabel: "Delete account",
              danger: true,
            };
          },
          done: "Account deleted.",
        },
      ]}
    />
  );
}

/** "Extend trial" on the admin overview's Needs attention list: seven more days, after a confirm. */
export function AdminExtendTrial({ venueId, name, offline }: { venueId: string; name: string; offline: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      disabled={pending}
      onClick={async () => {
        const ok = await confirm({
          title: `Give ${name} ${TRIAL_EXTENSION_DAYS} more trial days?`,
          body: offline ? "Its trial restarts from today, so the guest page comes back online now." : "They're added to the end of the current trial.",
          confirmLabel: "Extend trial",
        });
        if (!ok) return;
        setPending(true);
        try {
          await dashboardApi.adminUpdateVenue(venueId, { extendTrialDays: TRIAL_EXTENSION_DAYS });
          toast({ text: "Trial extended." });
          router.refresh();
        } catch (err) {
          toast({ text: errorMessage(err), tone: "error" });
        } finally {
          setPending(false);
        }
      }}
    >
      {pending && <Loader2 className="spin" aria-hidden />} Extend trial
    </button>
  );
}
