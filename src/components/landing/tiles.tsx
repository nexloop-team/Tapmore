"use client";

import { ArrowUpRight, Copy, Heart, Lock, MessageSquareText, Star, UtensilsCrossed, Wifi } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import type { MemberCardView } from "@/lib/api/contracts";
import { copyToClipboard, type CardCredentials } from "@/lib/browser";
import { isRewardsOnly, wifiGateActive, wifiView } from "@/lib/venue/features";
import { useLanding } from "./LandingContext";

/**
 * What goes inside each bento tile in the grid layout. The tile itself (the
 * button, its shade and size) comes from FeatureCard; these are just the faces.
 */

function TileTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <span className="tile-text">
      <span className="tile-title">{children}</span>
      {sub && <span className="tile-sub">{sub}</span>}
    </span>
  );
}

const MAX_SEGMENTS = 12;

function Segments({ filled, total }: { filled: number; total: number }) {
  const count = Math.max(1, Math.min(total, MAX_SEGMENTS));
  const lit = total > MAX_SEGMENTS ? Math.round((filled / total) * count) : filled;
  return (
    <span className="tile-segments" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={i < lit ? "on" : undefined} />
      ))}
    </span>
  );
}

/** The member's stamps for the tile; one fetch, the sheet keeps it live. */
function useCardSummary(credentials: CardCredentials | null): MemberCardView | null {
  const [card, setCard] = useState<MemberCardView | null>(null);
  useEffect(() => {
    if (!credentials) return;
    let stopped = false;
    api
      .getCard(credentials.cardId, credentials.token)
      .then((next) => !stopped && setCard(next))
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, [credentials]);
  return credentials ? card : null;
}

/** Wide hero tile: "3/8 · 5 more → Free coffee", or how to join. */
export function LoyaltyTile({ label, credentials }: { label: string; credentials: CardCredentials | null }) {
  const { venue, t, tf } = useLanding();
  const card = useCardSummary(credentials);
  const program = venue.loyaltyProgram;

  if (isRewardsOnly(venue) || !program) {
    return (
      <>
        <span className="tile-loyalty-top">
          <span className="tile-big">
            <Heart aria-hidden className="tile-big-icon" fill="currentColor" />
          </span>
          <TileTitle sub={t("tile_club_sub")}>{label}</TileTitle>
        </span>
        <span className="tile-chip tile-chip-light">{t("tile_join")}</span>
      </>
    );
  }

  const goal = card?.goal || program.stampsRequired;
  const stamps = card ? Math.min(card.stamps, goal) : 0;
  const tiers = card?.tiers.length ? card.tiers : [{ rewardName: program.rewardName, stampsRequired: program.stampsRequired, unlocked: false }];
  const next = tiers.find((tier) => tier.stampsRequired > (card?.stamps ?? 0)) ?? null;
  const ready = !!card && tiers.some((tier) => tier.unlocked);

  return (
    <>
      <span className="tile-loyalty-top">
        <span className="tile-big" aria-label={card ? `${stamps}/${goal}` : undefined}>
          {card ? (
            <>
              {stamps}
              <small>/{goal}</small>
            </>
          ) : (
            goal
          )}
        </span>
        <span className="tile-text">
          <span className="tile-eyebrow">{credentials ? (card?.holder ? tf("tile_stamps_name", { name: card.holder.split(" ")[0] }) : t("feature_my_card")) : label}</span>
          <span className="tile-pill">
            {ready ? t("tile_reward_ready") : card && next ? tf("tile_stamps_more", { count: next.stampsRequired - card.stamps, reward: next.rewardName.toLowerCase() }) : card ? program.rewardName : tf("tile_collect", { count: goal, reward: program.rewardName.toLowerCase() })}
          </span>
        </span>
      </span>
      <Segments filled={stamps} total={goal} />
      <span className="tile-chip tile-chip-light">{credentials ? t("card_show_staff") : t("tile_join")}</span>
    </>
  );
}

/** Tall pale tile with a big faint knife and fork, and an arrow out. */
export function MenuTile({ label }: { label: string }) {
  const { venue, t, tf } = useLanding();
  // "Today: Pumpkin Spice Latte" when a dish is marked as today's special.
  const special = venue.menus.flatMap((menu) => menu.sections.flatMap((section) => section.items)).find((item) => item.featured && item.isAvailable);
  return (
    <>
      <TileTitle sub={special ? tf("tile_menu_today", { name: special.name }) : t("tile_menu_sub")}>{label}</TileTitle>
      <UtensilsCrossed className="tile-art" aria-hidden strokeWidth={1.25} />
      <span className="tile-go" aria-hidden>
        <ArrowUpRight />
      </span>
    </>
  );
}

/** Network name and how to get on; the copy happens in WifiTileButton when there's no email gate. */
export function WifiTile({ label, status, unlocked = false }: { label: string; status: string; unlocked?: boolean }) {
  const { venue } = useLanding();
  const wifi = wifiView(venue);
  const gated = wifiGateActive(venue);
  return (
    <>
      <span className="tile-row">
        <TileTitle>{label}</TileTitle>
        <span className="tile-icon-btn" aria-hidden>
          {(wifi.canCopyPassword && !gated) || unlocked ? <Copy /> : gated ? <Lock /> : <Wifi />}
        </span>
      </span>
      <span className="tile-text tile-bottom">
        <span className="tile-sub tile-strong" aria-live="polite">
          {status}
        </span>
        {wifi.ssid && <span className="tile-sub">{wifi.ssid}</span>}
      </span>
    </>
  );
}

/** One tap copies the Wi-Fi password, no sheet: no email gate, or a guest this phone already knows. */
export function useWifiCopy(unlockedPassword?: string | null) {
  const { venue, t, track } = useLanding();
  const wifi = wifiView(venue);
  // Behind the email gate the page only has the password for a guest it knows (see useKnownGuestWifi).
  const password = unlockedPassword || wifi.password;
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    track("wifi_copy_password");
    try {
      await copyToClipboard(password);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2000);
  }

  const status = copied === "copied" ? t("tile_wifi_copied") : copied === "failed" ? t("failed") : t("tile_wifi_copy");
  return { canCopy: !!unlockedPassword || wifi.canCopyPassword, copy, status };
}

export function FeedbackTile({ label }: { label: string }) {
  const { t } = useLanding();
  return (
    <>
      <MessageSquareText className="tile-glyph" aria-hidden />
      <TileTitle sub={t("tile_feedback_sub")}>{label}</TileTitle>
    </>
  );
}

export function ReviewTile({ label }: { label: string }) {
  return (
    <>
      <span className="tile-stars" aria-hidden>
        <Star fill="currentColor" />
        <Star fill="currentColor" />
        <Star fill="currentColor" />
      </span>
      <TileTitle>{label}</TileTitle>
    </>
  );
}

/** A corner of a Sudoku board as the tile's picture. */
export function SudokuTile({ label }: { label: string }) {
  const cells = ["5", "", "3", "", "7", "", "1", "", "9"];
  return (
    <>
      <span className="tile-sudoku" aria-hidden>
        {cells.map((value, i) => (
          <span key={i}>{value}</span>
        ))}
      </span>
      <TileTitle>{label}</TileTitle>
    </>
  );
}

export function LinkTile({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <>
      <span className="tile-row">
        <span className="tile-glyph">{icon}</span>
        <span className="tile-go tile-go-small" aria-hidden>
          <ArrowUpRight />
        </span>
      </span>
      <TileTitle>{label}</TileTitle>
    </>
  );
}

type Sized = { size: "wide" | "tall" | "small" };

/**
 * Bento sizes for the cards, in the owner's order with no holes: loyalty
 * spans the row; the menu stands tall beside the next two small tiles when
 * there are two; small tiles pair up, and one left without a partner spans
 * the row.
 */
export function tileSizes(features: string[]): Record<string, Sized["size"]> {
  const sizes: Record<string, Sized["size"]> = {};
  let column = 0;
  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    if (feature === "loyalty") {
      if (column === 1) widenPrevious(features, i, sizes);
      sizes[feature] = "wide";
      column = 0;
      continue;
    }
    const following = features.slice(i + 1, i + 3);
    if (feature === "menu" && column === 0 && following.length === 2 && following.every((f) => f !== "loyalty")) {
      sizes[feature] = "tall";
      sizes[following[0]] = "small";
      sizes[following[1]] = "small";
      i += 2;
      continue;
    }
    sizes[feature] = "small";
    column = column === 0 ? 1 : 0;
  }
  if (column === 1) widenPrevious(features, features.length, sizes);
  return sizes;
}

/** The small tile just before `index` had no partner: let it take the whole row. */
function widenPrevious(features: string[], index: number, sizes: Record<string, Sized["size"]>) {
  const previous = features[index - 1];
  if (previous && sizes[previous] === "small") sizes[previous] = "wide";
}
