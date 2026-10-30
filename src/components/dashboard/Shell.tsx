"use client";

import { Building2, ChevronsUpDown, CreditCard, Gift, History, LayoutDashboard, LifeBuoy, LogOut, Menu, MessageSquareText, Palette, Plus, QrCode, Settings, Shield, Star, Store, type LucideIcon, UserRound, Users, X } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CATALOGUE_ICONS } from "@/components/catalogue-icon";
import { BrandMark } from "@/components/icons";
import { BRAND } from "@/config/brand";
import { dashboardApi } from "@/lib/api/dashboard-client";
import { initials } from "@/lib/format";
import { businessProfile, capitalise, personWord } from "@/lib/venue/business";
import { ConfirmProvider } from "./confirm";
import { forgetReadInbox, useReadInboxes } from "./FeedbackSeen";
import { ToastProvider } from "./toast";

interface ShellVenue {
  id: string;
  name: string;
  /** Feedback the owner hasn't opened yet: a count on the Feedback nav item. */
  unreadFeedback?: number;
  /** Google review replies waiting for approval: a count on the Google reviews item. */
  awaitingReviews?: number;
  /** "Active", "Trial · 3 days left" or "Unpaid", shown under the name in the switcher. */
  planLabel?: string;
  logoUrl: string | null;
  /** "cafe", "shop"…: "Menu" or "Products" in the sidebar. */
  venueType?: string | null;
}

interface ShellUser {
  name: string;
  email: string;
  isAdmin: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon?: LucideIcon;
  venue?: ShellVenue;
  /** Match the path exactly rather than as a prefix (section roots). */
  exact?: boolean;
  badge?: string;
  /** A quiet total beside the label (admin sidebar). */
  total?: number;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

function venueNav(base: string, unreadFeedback = 0, reviews: { enabled: boolean; awaiting: number } = { enabled: false, awaiting: 0 }, venueType?: string | null): NavGroup[] {
  const profile = businessProfile(venueType);
  const person = personWord(profile);
  return [
    { items: [{ href: base, label: "Overview", icon: LayoutDashboard, exact: true }] },
    {
      label: `${person} experience`,
      items: [
        { href: `${base}/design`, label: `${person} page`, icon: Palette },
        { href: `${base}/menu`, label: profile.catalogue, icon: CATALOGUE_ICONS[profile.icon] },
        { href: `${base}/loyalty`, label: "Rewards", icon: Gift },
        { href: `${base}/qr`, label: "QR codes", icon: QrCode },
      ],
    },
    {
      label: "Insights",
      items: [
        { href: `${base}/guests`, label: capitalise(profile.people), icon: Users },
        { href: `${base}/feedback`, label: "Feedback", icon: MessageSquareText, badge: unreadFeedback > 0 ? String(unreadFeedback) : undefined },
        ...(reviews.enabled ? [{ href: `${base}/reviews`, label: "Google reviews", icon: Star, badge: reviews.awaiting > 0 ? String(reviews.awaiting) : undefined }] : []),
      ],
    },
    {
      label: "Business",
      items: [
        { href: `${base}/billing`, label: "Subscription", icon: CreditCard },
        { href: `${base}/settings`, label: "Settings", icon: Settings },
      ],
    },
  ];
}

const ADMIN_NAV: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/admin/venues", label: "Businesses", icon: Building2 },
      { href: "/admin/accounts", label: "Accounts", icon: Users },
      { href: "/admin/activity", label: "Activity log", icon: History },
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function VenueAvatar({ venue, name }: { venue?: { name: string; logoUrl: string | null }; name?: string }) {
  const logo = venue?.logoUrl;
  return (
    <span className="venue-avatar" style={logo ? { backgroundImage: `url("${logo.replace(/"/g, "")}")` } : undefined} aria-hidden>
      {!logo && initials(venue?.name ?? name, "·")}
    </span>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  return (
    <li>
      <Link className="nav-link" href={item.href} aria-current={isActive(pathname, item) ? "page" : undefined}>
        {item.venue ? <VenueAvatar venue={item.venue} /> : Icon && <Icon aria-hidden />}
        <span className="nav-label">{item.label}</span>
        {item.badge && <span className="nav-count" aria-label={`${item.badge} unread`}>{item.badge}</span>}
        {item.total !== undefined && <span className="nav-total">{item.total.toLocaleString("en-IN")}</span>}
      </Link>
    </li>
  );
}

function VenueSwitcher({ venues, current }: { venues: ShellVenue[]; current: string }) {
  const router = useRouter();
  const active = venues.find((venue) => venue.id === current);
  if (venues.length === 0) return null;
  return (
    <div className="venue-switch">
      <VenueAvatar venue={active} name={active ? undefined : "All businesses"} />
      <span className="venue-switch-text" aria-hidden>
        <strong>{active ? active.name : current ? "Another business" : "All businesses"}</strong>
        {active?.planLabel && <span>{active.planLabel}</span>}
      </span>
      <select
        aria-label="Switch business"
        value={active ? active.id : ""}
        onChange={(event) => router.push(event.target.value === "__new" ? "/onboarding" : `/dashboard/${event.target.value}`)}
      >
        {!active && <option value="">{current ? "Another business" : "All businesses"}</option>}
        {venues.map((venue) => (
          <option key={venue.id} value={venue.id}>
            {venue.name}
          </option>
        ))}
        <option value="__new">+ Add a business</option>
      </select>
      <ChevronsUpDown aria-hidden />
    </div>
  );
}

function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <li>
      <button
        type="button"
        className="nav-link"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await dashboardApi.logout();
          } finally {
            router.replace("/login");
            router.refresh();
          }
        }}
      >
        <LogOut aria-hidden />
        <span className="nav-label">{pending ? "Signing out…" : "Sign out"}</span>
      </button>
    </li>
  );
}

function Brand({ mode }: { mode: "venue" | "admin" }) {
  return (
    <span className="shell-brand">
      <Link className="wordmark" href={mode === "admin" ? "/admin" : "/dashboard"}>
        <BrandMark />
        {BRAND.name}
      </Link>
      {mode === "admin" && <span className="badge badge-admin">Admin</span>}
    </span>
  );
}

/**
 * Sidebar app frame for the merchant dashboard and the operator console.
 * The sidebar is static from 1024px up and an off-canvas drawer below.
 */
export function AppShell({
  mode,
  venues,
  user,
  counts,
  lastVenueId,
  ownsVenues = false,
  reviews = false,
  children,
}: {
  mode: "venue" | "admin";
  venues: ShellVenue[];
  user: ShellUser;
  /** Admin: totals beside nav items, keyed by href. */
  counts?: Record<string, number>;
  /** The venue the owner last had open, so Account and Help keep its sidebar. */
  lastVenueId?: string | null;
  /** Admin: this admin also runs a venue of their own, so "My venues" leads somewhere. */
  ownsVenues?: boolean;
  /** Google review replies are set up on this server: show their nav item. */
  reviews?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams<{ venueId?: string }>();
  // An inbox read since the server last counted shows 0 here, unless more notes
  // than were read have come in since. Once the server's count reads 0 there's
  // nothing left to hide.
  const readInboxes = useReadInboxes();
  useEffect(() => {
    for (const venue of venues) if (venue.unreadFeedback === 0) forgetReadInbox(venue.id);
  }, [venues]);
  const unreadFor = (id: string) => {
    const count = venues.find((v) => v.id === id)?.unreadFeedback;
    const read = readInboxes[id];
    return count !== undefined && read !== undefined && count <= read ? 0 : count;
  };
  // Remembering which path the drawer was opened on closes it on navigation without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenOn(null);
      menuButton.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Pages outside a venue (Account, Help) keep the last venue's sidebar, or the only venue's.
  const fallbackVenue = venues.some((v) => v.id === lastVenueId) ? lastVenueId! : venues.length === 1 ? venues[0].id : "";
  const venueId = mode === "venue" ? (params.venueId ?? fallbackVenue) : "";

  // Remember the venue in view for those pages.
  useEffect(() => {
    if (mode === "venue" && params.venueId) document.cookie = `tt_venue=${encodeURIComponent(params.venueId)}; path=/; max-age=31536000; SameSite=Lax`;
  }, [mode, params.venueId]);
  const groups: NavGroup[] =
    mode === "admin"
      ? ADMIN_NAV.map((group) => ({ ...group, items: group.items.map((item) => (counts?.[item.href] !== undefined ? { ...item, total: counts[item.href] } : item)) }))
      : venueId
        ? venueNav(`/dashboard/${venueId}`, unreadFor(venueId), { enabled: reviews, awaiting: venues.find((v) => v.id === venueId)?.awaitingReviews ?? 0 }, venues.find((v) => v.id === venueId)?.venueType)
        : [
            {
              label: "Your businesses",
              items: [
                ...venues.map((venue) => ({ href: `/dashboard/${venue.id}`, label: venue.name, venue })),
                { href: "/onboarding", label: "Add a business", icon: Plus },
              ],
            },
          ];

  return (
    <div className={`shell ${mode === "admin" ? "shell-admin" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="mobilebar">
        <button
          ref={menuButton}
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => setOpenOn(pathname)}
        >
          <Menu aria-hidden />
        </button>
        <Brand mode={mode} />
      </header>

      {open && <div className="sidebar-scrim" aria-hidden onClick={() => setOpenOn(null)} />}

      <aside id="app-sidebar" className="sidebar" data-open={open} aria-label="Main navigation">
        <div className="sidebar-head">
          <Brand mode={mode} />
          <button ref={closeButton} type="button" className="btn btn-ghost btn-icon sidebar-close" aria-label="Close navigation" onClick={() => setOpenOn(null)}>
            <X aria-hidden />
          </button>
        </div>

        {mode === "venue" && <VenueSwitcher venues={venues} current={venueId} />}

        <nav className="sidebar-body" aria-label={mode === "admin" ? "Platform" : "Business"}>
          {groups.map((group, index) => (
            <div key={group.label ?? index} className="nav-group">
              {group.label && <div className="nav-group-label">{group.label}</div>}
              <ul className="nav-list">
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <ul className="nav-list">
            {mode === "admin" ? (
              ownsVenues && <NavLink item={{ href: "/dashboard", label: "My businesses", icon: Store, exact: true }} pathname={pathname} />
            ) : (
              user.isAdmin && <NavLink item={{ href: "/admin", label: "Platform admin", icon: Shield }} pathname={pathname} />
            )}
            {/* Help is for venue owners; the operator console has no need of it. */}
            {mode === "venue" && (
              <li>
                <Link className="nav-link" href={`/dashboard/help${venueId ? `?v=${venueId}` : ""}`} aria-current={pathname === "/dashboard/help" ? "page" : undefined}>
                  <LifeBuoy aria-hidden />
                  <span className="nav-label">Help &amp; contact</span>
                </Link>
              </li>
            )}
            <NavLink item={{ href: "/dashboard/account", label: "Account", icon: UserRound }} pathname={pathname} />
            <SignOutButton />
          </ul>
          <div className="user-card">
            <span className="avatar" aria-hidden>
              {initials(user.name || user.email)}
            </span>
            <span className="user-card-text">
              <strong>{user.name || "Your account"}</strong>
              <span>{user.email}</span>
            </span>
          </div>
        </div>
      </aside>

      <div className="shell-main">
        <ConfirmProvider>
          <ToastProvider>
            <main id="main" tabIndex={-1}>
              {children}
            </main>
          </ToastProvider>
        </ConfirmProvider>
      </div>
    </div>
  );
}

export function ResendVerification() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  if (state === "sent") return <span>Sent. Check your inbox.</span>;
  return (
    <button
      type="button"
      className="btn btn-sm"
      disabled={state === "sending"}
      onClick={async () => {
        setState("sending");
        try {
          await dashboardApi.resendVerification();
          setState("sent");
        } catch {
          setState("error");
        }
      }}
    >
      {state === "error" ? "Try again" : "Resend email"}
    </button>
  );
}
