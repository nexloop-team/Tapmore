"use client";

import { GripVertical, LayoutGrid, List, Plus, Rows4, Trash2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { LINK_ICON_TOKENS } from "@/components/icons";
import { buildFeatures, sanitiseExternalUrl, wifiView, type CoreFeature, type FeatureKey } from "@/lib/venue/features";
import { expandSocialLink } from "@/lib/venue/social";
import { LINK_LABEL_TOKENS } from "@/lib/venue/constants";
import type { VenueConfig } from "@/lib/venue/schema";
import type { ButtonShape, HeaderStyle, PageLayout, PublicVenue } from "@/lib/venue/types";
import { Card, Field, HelpTip, ImageField, newClientId, SaveBar, Switch, SwitchRow, TextField } from "./ui";
import { useLivePreview } from "@/lib/live-preview";
import { PreviewPane } from "./EditorFrame";
import { MobilePreview } from "./MobilePreview";
import { PalettePicker } from "./PalettePicker";
import { moveTo, useDragReorder } from "./useDragReorder";
import { useVenueDraft } from "./useVenueDraft";

const PRESETS = [
  { value: null, label: "Default", hint: "Phone's own font, fastest to load", font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", weight: 700 },
  { value: "classic", label: "Classic", hint: "Playfair Display, for bistros and pubs", font: "var(--font-classic), Georgia, serif", weight: 600 },
  { value: "editorial", label: "Editorial", hint: "Petrona, warm and bookish", font: "var(--font-editorial), Georgia, serif", weight: 600 },
  { value: "modern", label: "Modern", hint: "Outfit, clean and round", font: "var(--font-modern), system-ui, sans-serif", weight: 600 },
] as const;

const LAYOUTS: { value: PageLayout; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "list", label: "List", hint: "One card per row", icon: List },
  { value: "grid", label: "Bento", hint: "Big colourful tiles", icon: LayoutGrid },
  { value: "compact", label: "Compact", hint: "Shorter rows", icon: Rows4 },
];

const HEADER_STYLES: { value: HeaderStyle; label: string }[] = [
  { value: "cover", label: "Logo left" },
  { value: "centered", label: "Centred" },
  { value: "minimal", label: "No logo" },
];

const BUTTON_SHAPES: { value: ButtonShape; label: string }[] = [
  { value: "rounded", label: "Rounded" },
  { value: "pill", label: "Pill" },
  { value: "square", label: "Square" },
];

/** The dot colour beside each card in the order list: the same tint the guest page uses. */
const CARD_TINTS: Record<string, string> = {
  loyalty: "#D94D66",
  menu: "#FF9500",
  wifi: "#4DC778",
  sudoku: "#7D59D9",
  feedback: "#1447E6",
  google_review: "#5C6166",
};

/** Typed hex with or without "#"; only a full six-digit colour is applied. */
function HexInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <label className="input-prefix hex-input">
      <span aria-hidden>#</span>
      <input
        className="input"
        aria-label="Custom colour hex"
        value={text ?? value.replace(/^#/, "")}
        maxLength={7}
        spellCheck={false}
        onChange={(event) => {
          const next = event.target.value.replace(/^#/, "").toUpperCase();
          setText(next);
          if (/^[0-9A-F]{6}$/.test(next)) onChange(`#${next}`);
        }}
        onBlur={() => setText(null)}
      />
    </label>
  );
}

const LINK_LABELS: Record<(typeof LINK_LABEL_TOKENS)[number], string> = {
  view_menu: "View menu",
  view_price_list: "View price list",
  our_services: "Our services",
  book_now: "Book now",
  visit_website: "Visit website",
  order_online: "Order online",
};

/** What guests see on each card unless the owner renames it. */
const CARD_LABELS: Record<CoreFeature, string> = {
  loyalty: "Stamp card",
  menu: "Menu",
  wifi: "Wi-Fi",
  sudoku: "Sudoku",
  feedback: "Suggestion box",
  google_review: "Leave a Google review",
};

/** A numbered step title, so the page reads top to bottom in the order to set things up. */
function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <span className="step-title">
      <span className="step-num" aria-hidden>
        {n}
      </span>
      {children}
    </span>
  );
}

type Draft = Pick<VenueConfig, "branding" | "wifi" | "socialLinks" | "externalLinks" | "announcement">;

export function DesignEditor({
  venueId,
  shortCode,
  config,
}: {
  venueId: string;
  shortCode: string;
  config: VenueConfig;
}) {
  // Compiled by the React Compiler (annotation mode, see next.config): re-renders only what an edit touches.
  "use memo";
  const editor = useVenueDraft<Draft>(venueId, {
    branding: config.branding,
    wifi: config.wifi ?? null,
    socialLinks: config.socialLinks,
    externalLinks: config.externalLinks,
    announcement: config.announcement ?? null,
  });
  const { draft, update } = editor;
  useLivePreview(draft);
  const branding = draft.branding;
  const setBranding = (patch: Partial<Draft["branding"]>) => update("branding", { ...branding, ...patch });
  const links = draft.externalLinks;
  const setLinks = (next: Draft["externalLinks"]) => update("externalLinks", next);
  const social = draft.socialLinks;
  const setSocial = (patch: Partial<Draft["socialLinks"]>) => update("socialLinks", { ...social, ...patch });

  // What the guest page would show with this draft, in order.
  const previewVenue = { ...config, ...draft, id: venueId, shortCode, crm: config.crm } as unknown as PublicVenue;
  const features = buildFeatures(previewVenue);
  // Every card the page could show, switched on or not, so a hidden one keeps its row and can come back.
  // Wi-Fi and Google reviews are listed even before they're set up, since their settings live on their rows.
  const allFeatures = buildFeatures({
    ...previewVenue,
    wifi: { ...previewVenue.wifi, ssid: previewVenue.wifi?.ssid || "-" },
    socialLinks: { ...previewVenue.socialLinks, google: sanitiseExternalUrl(previewVenue.socialLinks.google) ? previewVenue.socialLinks.google : "https://g.page/" },
    branding: { ...previewVenue.branding, sudokuEnabled: true, showGoogleReviewButton: true, hiddenFeatures: [] },
  } as PublicVenue);
  const hidden = branding.hiddenFeatures ?? [];
  const [renaming, setRenaming] = useState<FeatureKey | null>(null);
  const wifi = wifiView(previewVenue);
  const titleHidden = typeof branding.titleOverride === "string" && branding.titleOverride !== "" && branding.titleOverride.trim() === "";

  function setOrder(order: FeatureKey[]) {
    setBranding({ featureOrder: order.map((key) => (key === "google_review" ? "googleReview" : key)) });
  }

  const drag = useDragReorder(allFeatures.length, (from, to) => setOrder(moveTo(allFeatures, from, to)));

  function linkFor(key: FeatureKey) {
    return key.startsWith("link:") ? links.find((l) => `link:${l.id}` === key) : undefined;
  }

  /** The label as guests will see it. */
  function featureLabel(key: FeatureKey): string {
    const link = linkFor(key);
    if (link) return link.labelCustom || (link.labelToken ? LINK_LABELS[link.labelToken] : link.url) || "Custom link";
    const core = key as CoreFeature;
    return branding.featureLabels?.[core]?.trim() || defaultLabel(key);
  }

  /** The owner's own wording for a card ("" when they kept the default). */
  function customLabel(key: FeatureKey): string {
    const link = linkFor(key);
    if (link) return link.labelCustom ?? "";
    return branding.featureLabels?.[key as CoreFeature] ?? "";
  }

  function setLabel(key: FeatureKey, value: string) {
    const link = linkFor(key);
    if (link) {
      setLinks(links.map((l) => (l === link ? { ...l, labelCustom: value, labelToken: value ? null : l.labelToken } : l)));
      return;
    }
    const next = { ...branding.featureLabels, [key]: value };
    if (!value) delete next[key as CoreFeature];
    setBranding({ featureLabels: next });
  }

  function defaultLabel(key: FeatureKey): string {
    const link = linkFor(key);
    if (link) return link.labelToken ? LINK_LABELS[link.labelToken] : "Label for this link";
    // Rewards-only venues run a members club, not a stamp card.
    if (key === "loyalty" && config.loyaltyProgram?.stampsEnabled === false) return "Join the members club";
    return CARD_LABELS[key as CoreFeature] ?? key;
  }

  function featureNote(key: FeatureKey): string {
    if (key.startsWith("link:")) {
      const link = links.find((l) => `link:${l.id}` === key);
      return `Custom link${link?.url ? ` · ${link.url.replace(/^https?:\/\//, "")}` : ""}`;
    }
    switch (key) {
      case "loyalty":
        return config.loyaltyProgram?.stampsEnabled === false ? "Expands · members club" : `Expands · ${config.loyaltyProgram?.stampsRequired ?? 10} stamps`;
      case "menu":
        return config.menus.some((menu) => menu.externalUrl) ? "Links to your menu" : "Hosted menu";
      case "wifi":
        return wifi.ssid ? `Network ${wifi.ssid}` : "Add your network below to show this card";
      case "feedback":
        return branding.featureLabels?.feedback?.trim()
          ? "Then invites a Google review"
          : "Guests see “Suggestion box” or “Anonymous feedback” while we test which gets more replies. Rename it to choose.";
      case "google_review":
        return sanitiseExternalUrl(social.google) ? "Links to your Google page" : "Add your review link below to show this card";
      case "sudoku":
        return "Expands · a quick puzzle";
      default:
        return "";
    }
  }

  /** Every card can be switched off; Sudoku and the Google review card keep their own settings. */
  function featureSwitch(key: FeatureKey): { checked: boolean; onChange: (on: boolean) => void } {
    if (key === "sudoku") return { checked: branding.sudokuEnabled !== false, onChange: (on) => setBranding({ sudokuEnabled: on }) };
    if (key === "google_review") return { checked: !!branding.showGoogleReviewButton, onChange: (on) => setBranding({ showGoogleReviewButton: on }) };
    return {
      checked: !hidden.includes(key),
      onChange: (on) => setBranding({ hiddenFeatures: on ? hidden.filter((k) => k !== key) : [...hidden, key] }),
    };
  }

  /** Settings that belong to one card, shown under its row so they're never far from it. */
  function cardSettings(key: FeatureKey) {
    if (key === "wifi")
      return (
        <div className="feature-row-settings" id="wifi">
              <div className="row">
                <TextField
                  label="Network name"
                  value={draft.wifi?.ssid}
                  onChange={(value) => update("wifi", value ? { ...(draft.wifi ?? {}), ssid: value } : null)}
                  maxLength={64}
                />
                <TextField
                  label="Password"
                  value={draft.wifi?.password}
                  onChange={(value) => draft.wifi && update("wifi", { ...draft.wifi, password: value, security: value ? "WPA2" : "open" })}
                  maxLength={128}
                  hint={draft.wifi ? undefined : "Add a network name first."}
                />
              </div>
        </div>
      );
    if (key === "google_review")
      return (
        <div className="feature-row-settings" id="google">
              <TextField
                label="Review link"
                value={social.google}
                onChange={(value) => setSocial({ google: value })}
                placeholder="https://g.page/r/…/review"
                type="url"
                hint="Google Business Profile → Ask for reviews → copy link."
              />
              <HelpTip question="How do I find my Google review link?">
                <ol>
                  <li>On your phone, open Google Maps (or search for your venue on Google) while signed in to the account that manages it.</li>
                  <li>Open your Business Profile and tap <strong>Ask for reviews</strong> (sometimes &ldquo;Get more reviews&rdquo;).</li>
                  <li>Tap <strong>Copy link</strong> and paste it above. It starts with https://g.page/ or https://g.co/.</li>
                </ol>
              </HelpTip>
        </div>
      );
    if (key === "menu")
      return (
        <div className="feature-row-settings feature-row-link">
          <Link href={`/dashboard/${venueId}/menu`}>Edit your menu</Link>
        </div>
      );
    if (key === "loyalty")
      return (
        <div className="feature-row-settings feature-row-link">
          <Link href={`/dashboard/${venueId}/loyalty`}>Rewards and stamps</Link>
        </div>
      );
    return null;
  }

  return (
    <div className="editor-grid">
      <div>
        <MobilePreview src={`/s?i=${encodeURIComponent(shortCode)}&s=preview`} label="Preview your page" dirty={editor.dirty} />
        <div className="editor-flow">
          <Card id="logo" title={<Step n={1}>Header</Step>} description="The top of your page: who you are at a glance.">
            <div className="row">
              <ImageField venueId={venueId} kind="logo" label="Logo" value={branding.logoUrl} onChange={(url) => setBranding({ logoUrl: url })} hint="Square, at least 300×300." />
              <ImageField venueId={venueId} kind="cover" label="Cover photo" value={branding.coverImageUrl} onChange={(url) => setBranding({ coverImageUrl: url })} hint="Landscape, about 1200×600." wide />
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <TextField
                label="Title"
                value={titleHidden ? "" : branding.titleOverride}
                onChange={(value) => setBranding({ titleOverride: value })}
                placeholder={config.name}
                maxLength={80}
                hint="Leave blank to use your venue name."
              />
              <TextField
                label="Tagline"
                value={branding.tagline}
                onChange={(value) => setBranding({ tagline: value })}
                placeholder="Slow coffee, good company"
                maxLength={Math.max(60, branding.tagline?.length ?? 0)}
                hint={`${branding.tagline?.length ?? 0} / 60 · short lines read best over your photo`}
              />
            </div>
            <SwitchRow
              title="Hide the title"
              description="Useful when your logo already spells out the name."
              checked={titleHidden}
              onChange={(on) => setBranding({ titleOverride: on ? " " : null })}
            />
          </Card>

          <Card title={<Step n={2}>Colours</Step>} description="Pick a palette. It sets the page and every tile, and text stays readable on each.">
            <PalettePicker branding={branding} onChange={setBranding} customInput={(value, onChange) => <HexInput value={value} onChange={onChange} />} />
          </Card>

          <Card title={<Step n={3}>Typography</Step>} description="The face for your name, headings and dish names. Everything else stays in a fast, plain font.">
              <div className="type-grid" role="group" aria-label="Typography">
                {PRESETS.map((preset) => (
                  <button key={preset.label} type="button" className="type-option" aria-pressed={(branding.style ?? null) === preset.value} onClick={() => setBranding({ style: preset.value })}>
                    {/* The venue's own name in this face, as guests will see it. */}
                    <span className="type-sample" style={{ fontFamily: preset.font, fontWeight: preset.weight }} aria-hidden>
                      {branding.titleOverride?.trim() || config.name}
                    </span>
                    <span className="type-label">
                      {preset.label}
                      <span className="preset-hint">{preset.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
          </Card>

          <Card title={<Step n={4}>Layout</Step>} description="How your cards and header are arranged. Bento turns the cards into colourful tiles that open as pop-ups.">
            <div className="field">
              <span className="field-label" id="layout-label">
                Cards
              </span>
              <div className="preset-grid" role="group" aria-labelledby="layout-label">
                {LAYOUTS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="preset"
                    aria-pressed={(branding.layout ?? "list") === option.value}
                    onClick={() => setBranding({ layout: option.value === "list" ? null : option.value })}
                  >
                    <option.icon className="preset-icon" aria-hidden />
                    <span>
                      {option.label}
                      <span className="preset-hint">{option.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="row">
              <div className="field">
                <span className="field-label" id="header-style-label">
                  Header
                </span>
                <div className="segmented" role="group" aria-labelledby="header-style-label">
                  {HEADER_STYLES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={(branding.headerStyle ?? "cover") === option.value}
                      onClick={() => setBranding({ headerStyle: option.value === "cover" ? null : option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span className="field-label" id="shape-label">
                  Corners
                </span>
                <div className="segmented" role="group" aria-labelledby="shape-label">
                  {BUTTON_SHAPES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={(branding.buttonShape ?? "rounded") === option.value}
                      onClick={() => setBranding({ buttonShape: option.value === "rounded" ? null : option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card title={<Step n={5}>Cards</Step>} description="Drag to reorder, switch off, or rename in your own words. Each card's settings sit right under it." actions={<span className="hint">{features.length} showing</span>}>
            <ul className="feature-rows">
              {allFeatures.map((key, index) => {
                const toggle = featureSwitch(key);
                const on = features.includes(key);
                const tint = key.startsWith("link:") ? "#9C27B0" : (CARD_TINTS[key] ?? "#5C6166");
                const label = featureLabel(key);
                return (
                  <li key={key} ref={drag.rowRef(index)} className={`feature-row${on ? "" : " off"}${drag.dragging === index ? " dragging" : ""}`}>
                    <div className="feature-row-main">
                    <button type="button" className="drag-handle" aria-label={`Reorder ${label}. Use the arrow keys to move it.`} {...drag.handleProps(index)}>
                      <GripVertical aria-hidden />
                    </button>
                    <span className="feature-row-dot" style={{ background: `${tint}22` }} aria-hidden>
                      <span style={{ background: tint }} />
                    </span>
                    <span className="feature-row-text">
                      {renaming === key ? (
                        <input
                          className="input feature-rename"
                          aria-label={`Card label for ${label}`}
                          value={customLabel(key)}
                          placeholder={defaultLabel(key)}
                          maxLength={40}
                          autoFocus
                          onChange={(event) => setLabel(key, event.target.value)}
                          onBlur={() => setRenaming(null)}
                          onKeyDown={(event) => (event.key === "Enter" || event.key === "Escape") && setRenaming(null)}
                        />
                      ) : (
                        <strong>{label}</strong>
                      )}
                      <span>{on ? featureNote(key) : "Hidden from guests"}</span>
                    </span>
                    {renaming !== key && (
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRenaming(key)}>
                        Rename
                      </button>
                    )}
                    <Switch label={`Show ${label}`} checked={toggle.checked} onChange={toggle.onChange} />
                    </div>
                    {cardSettings(key)}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card
            title={<Step n={6}>Custom links</Step>}
            description="Bookings, ordering, events, gift cards: anything with a link."
            actions={
              <button
                type="button"
                className="btn btn-sm"
                disabled={links.length >= 12}
                onClick={() => setLinks([...links, { id: newClientId("lnk"), url: "", labelCustom: "", icon: "link" }])}
              >
                <Plus aria-hidden /> Add link
              </button>
            }
          >
            {links.length === 0 ? (
              <p className="muted">No custom links yet.</p>
            ) : (
              <div className="list-editor">
                {links.map((link, index) => {
                  const set = (patch: Partial<typeof link>) => setLinks(links.map((l, i) => (i === index ? { ...l, ...patch } : l)));
                  return (
                    <div key={link.id} className="list-row">
                      <div className="row">
                        <TextField label="Label" value={link.labelCustom} onChange={(value) => set({ labelCustom: value, labelToken: value ? null : link.labelToken })} placeholder="Book a table" maxLength={60} />
                        <TextField label="Link" value={link.url} onChange={(value) => set({ url: value ?? "" })} placeholder="https://" type="url" />
                        <Field label="Icon" htmlFor={`icon-${link.id}`}>
                          <select id={`icon-${link.id}`} className="select" value={link.icon ?? "link"} onChange={(event) => set({ icon: event.target.value as typeof link.icon })}>
                            {LINK_ICON_TOKENS.map((icon) => (
                              <option key={icon} value={icon}>
                                {icon}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <div className="spread" style={{ marginTop: 10 }}>
                        <span className="hint">{!link.labelCustom && !link.labelToken ? "Add a label so guests know where it goes." : ""}</span>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => setLinks(links.filter((_, i) => i !== index))}>
                          <Trash2 aria-hidden /> Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title={<Step n={7}>Social profiles</Step>} description="Shown as icons at the bottom of your page. Type your handle, like @junipercoffee, or paste a link.">
            <div className="row">
              <TextField
                label="Instagram"
                value={social.instagram}
                onChange={(value) => setSocial({ instagram: value })}
                onBlur={() => setSocial({ instagram: expandSocialLink("instagram", social.instagram) })}
                placeholder="@yourcafe"
              />
              <TextField
                label="Facebook"
                value={social.facebook}
                onChange={(value) => setSocial({ facebook: value })}
                onBlur={() => setSocial({ facebook: expandSocialLink("facebook", social.facebook) })}
                placeholder="@yourcafe"
              />
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <TextField
                label="Tripadvisor"
                value={social.tripAdvisor}
                onChange={(value) => setSocial({ tripAdvisor: value })}
                onBlur={() => setSocial({ tripAdvisor: expandSocialLink("tripAdvisor", social.tripAdvisor) })}
                placeholder="Paste your Tripadvisor link"
              />
              <TextField
                label="YouTube"
                value={social.youtube}
                onChange={(value) => setSocial({ youtube: value })}
                onBlur={() => setSocial({ youtube: expandSocialLink("youtube", social.youtube) })}
                placeholder="@yourchannel"
              />
            </div>
          </Card>

          <Card title={<Step n={8}>Announcement</Step>} description="A short message at the top of your page: today's special, an event, holiday hours.">
            <div className="row">
              <TextField
                label="Message"
                value={draft.announcement?.text}
                onChange={(value) => update("announcement", value ? { text: value, until: draft.announcement?.until ?? null } : null)}
                placeholder="Today's special: pumpkin spice latte"
                maxLength={160}
              />
              <Field label="Show until (optional)" htmlFor="announcement-until" hint="It disappears by itself after this day.">
                <input
                  id="announcement-until"
                  className="input"
                  type="date"
                  disabled={!draft.announcement?.text}
                  value={draft.announcement?.until ?? ""}
                  onChange={(event) => draft.announcement && update("announcement", { ...draft.announcement, until: event.target.value || null })}
                />
              </Field>
            </div>
          </Card>
        </div>
      </div>

      <PreviewPane src={`/s?i=${encodeURIComponent(shortCode)}&s=preview&embed=1`} title="Live page preview" fullHref={`/s?i=${encodeURIComponent(shortCode)}&s=preview`} />

      <SaveBar dirty={editor.dirty} saving={editor.saving} error={editor.error} onSave={editor.save} onReset={editor.reset} />
    </div>
  );
}
