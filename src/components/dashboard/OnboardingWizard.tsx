"use client";

import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { BrandMark } from "@/components/icons";
import { BRAND } from "@/config/brand";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { initials } from "@/lib/format";
import { PALETTES } from "@/lib/palettes";
import { computeTheme, isLightColor } from "@/lib/theme";
import { CURRENCIES, VENUE_TYPES, type CreateVenueRequest } from "@/lib/venue/schema";
import type { VenueBranding } from "@/lib/venue/types";
import { Field, TextField } from "./ui";

const TYPE_LABELS: Record<(typeof VENUE_TYPES)[number], string> = {
  cafe: "Café",
  restaurant: "Restaurant",
  bakery: "Bakery",
  pub: "Pub",
  bar: "Bar",
  hotel: "Hotel",
  other: "Something else",
};

const STEPS = ["Venue", "Colours", "Essentials", "Loyalty"];

/** The guest page as it will look, drawn from the answers so far (the venue doesn't exist yet). */
function GuestPreview({ name, tagline, color, palette, cards }: { name: string; tagline: string | null; color: string; palette: string | null; cards: { label: string; tint: string }[] }) {
  const theme = computeTheme({ backgroundColorHex: color, palette } as VenueBranding);
  return (
    <div className="ob-guest" style={theme.vars as CSSProperties}>
      <div className="ob-guest-head">
        <span className="ob-guest-logo">{initials(name, "·")}</span>
        <span>
          {tagline?.trim() && <span className="ob-guest-tagline">{tagline}</span>}
          <strong>{name.trim() || "Your venue"}</strong>
        </span>
      </div>
      <ul>
        {cards.map((card) => (
          <li key={card.label}>
            <span className="ob-guest-dot" style={{ "--tint": card.tint } as CSSProperties} />
            {card.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HexField({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <span className="input-prefix hex-input">
      <span aria-hidden>#</span>
      <input
        id="hex"
        className="input"
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
    </span>
  );
}

export function OnboardingWizard({ defaultCurrency, exitHref, notice }: { defaultCurrency: (typeof CURRENCIES)[number]; exitHref: string | null; notice?: ReactNode }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [venueType, setVenueType] = useState<(typeof VENUE_TYPES)[number]>("cafe");
  const [currencyCode, setCurrency] = useState(defaultCurrency);
  const [color, setColour] = useState(PALETTES[0].bg);
  const [palette, setPalette] = useState<string | null>(PALETTES[0].id);
  const setColor = (hex: string) => {
    setColour(hex);
    setPalette(null);
  };
  const [tagline, setTagline] = useState<string | null>(null);
  const [menuUrl, setMenuUrl] = useState<string | null>(null);
  const [ssid, setSsid] = useState<string | null>(null);
  const [wifiPassword, setWifiPassword] = useState<string | null>(null);
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string | null>(null);
  const [loyaltyOn, setLoyaltyOn] = useState(true);
  const [rewardName, setRewardName] = useState<string | null>("Free coffee");
  const [stamps, setStamps] = useState(9);

  function validateStep(): string | null {
    if (step === 0 && !name.trim()) return "Give your venue a name";
    if (step === 2) {
      for (const [label, url] of [["Menu link", menuUrl], ["Google review link", googleReviewUrl]] as const) {
        if (url && !/^https?:\/\//i.test(url.trim())) return `${label} must start with https://`;
      }
    }
    if (step === 3 && loyaltyOn && !rewardName?.trim()) return "Name the reward guests collect stamps for";
    return null;
  }

  function next() {
    const problem = validateStep();
    setError(problem);
    if (!problem) setStep((s) => s + 1);
  }

  async function finish() {
    const problem = validateStep();
    if (problem) return setError(problem);
    setPending(true);
    setError(null);
    const body: CreateVenueRequest = {
      name: name.trim(),
      venueType,
      currencyCode,
      backgroundColorHex: color,
      palette,
      tagline,
      menuUrl: menuUrl?.trim() || null,
      googleReviewUrl: googleReviewUrl?.trim() || null,
      wifi: ssid?.trim() ? { ssid: ssid.trim(), password: wifiPassword, security: wifiPassword ? "WPA2" : "open" } : null,
      loyalty: loyaltyOn && rewardName ? { rewardName: rewardName.trim(), stampsRequired: stamps } : null,
    };
    try {
      const venue = await dashboardApi.createVenue(body);
      router.replace(`/dashboard/${venue.id}?welcome=1`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  const previewCards = [
    ...(step >= 3 && loyaltyOn ? [{ label: "Stamp card", tint: "#D94D66" }] : []),
    { label: "Menu", tint: "#FF9500" },
    ...(ssid?.trim() ? [{ label: "Wi-Fi", tint: "#4DC778" }] : []),
    { label: "Suggestion box", tint: "#1447E6" },
    ...(googleReviewUrl?.trim() ? [{ label: "Leave a Google review", tint: "#5C6166" }] : []),
  ];

  return (
    <div className="ob">
      <header className="ob-header">
        <div className="ob-bar">
          <Link className="wordmark" href="/">
            <BrandMark />
            {BRAND.name}
          </Link>
          <span className="ob-bar-end">
            <span className="ob-time">{step === STEPS.length - 1 ? "Almost done" : `About ${STEPS.length - step - 1} minute${STEPS.length - step - 1 === 1 ? "" : "s"} left`}</span>
            {exitHref && (
              <Link className="ob-exit" href={exitHref}>
                Back to dashboard
              </Link>
            )}
          </span>
        </div>
        <ol className="ob-steps" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((label, index) => (
            <li key={label} className={index <= step ? "done" : ""} aria-current={index === step ? "step" : undefined}>
              <span className="ob-steps-bar" aria-hidden />
              <span>
                {index + 1} · {label}
              </span>
            </li>
          ))}
        </ol>
      </header>

      <main className="ob-main">
        <section className="ob-form">
          {notice}
          <span className="ob-eyebrow">
            Step {step + 1} of {STEPS.length}
          </span>
          {step === 0 && (
            <>
              <h1>Tell us about your venue</h1>
              <p>This is what guests see at the top of your page.</p>
              <TextField label="Venue name" value={name} onChange={(v) => setName(v ?? "")} placeholder="e.g. Juniper Coffee House" maxLength={80} required />
              <div className="field">
                <span className="field-label">What kind of place is it?</span>
                <div className="choice-grid">
                  {VENUE_TYPES.map((type) => (
                    <button key={type} type="button" className="choice" aria-pressed={venueType === type} onClick={() => setVenueType(type)}>
                      {TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
                {(venueType === "pub" || venueType === "bar") && <p className="hint">Guests will confirm they&apos;re 18+ when they join your card.</p>}
              </div>
              <Field label="Currency for menu prices" htmlFor="currency">
                <select id="currency" className="select" value={currencyCode} onChange={(event) => setCurrency(event.target.value as typeof currencyCode)}>
                  {CURRENCIES.map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <h1>Pick a colour that feels like {name.trim() || "your place"}</h1>
              <p>We&apos;ll match the text and cards to it so everything stays easy to read. You can change it any time.</p>
              <fieldset className="ob-swatches">
                <legend className="field-label">Palettes</legend>
                <div className="ob-swatch-grid">
                  {PALETTES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="ob-swatch"
                      aria-pressed={palette === option.id}
                      onClick={() => {
                        setColour(option.bg);
                        setPalette(option.id);
                      }}
                    >
                      <span style={{ background: `linear-gradient(135deg, ${option.bg} 0 50%, ${option.hero} 50% 78%, ${option.pop} 78%)` }} aria-hidden />
                      {option.name}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="field ob-own-box">
                <span className="ob-own-title">
                  <label htmlFor="hex">Use your own colour</label>
                  <span className="hint">Paste a hex code from your sign or cups</span>
                </span>
                <div className="ob-own">
                  <input className="color-input" type="color" aria-label="Pick a custom colour" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} />
                  <HexField value={color} onChange={setColor} />
                  <span className="ob-readable">
                    <Check aria-hidden /> Readable with {isLightColor(color) ? "dark" : "white"} text
                  </span>
                </div>
              </div>
              <TextField label="Tagline (optional)" value={tagline} onChange={setTagline} placeholder="Slow coffee, good company" maxLength={120} />
            </>
          )}

          {step === 2 && (
            <>
              <h1>The essentials</h1>
              <p>All optional. Skip anything you don&apos;t have to hand and add it later.</p>
              <TextField
                label="Link to your menu"
                value={menuUrl}
                onChange={setMenuUrl}
                placeholder="https://"
                type="url"
                hint="Already have a menu online? Paste the link. Otherwise leave blank and build one with our menu editor."
              />
              <div className="row" style={{ marginTop: 14 }}>
                <TextField label="Wi-Fi network name" value={ssid} onChange={setSsid} placeholder="e.g. Juniper-Guest" maxLength={64} />
                <TextField label="Wi-Fi password" value={wifiPassword} onChange={setWifiPassword} placeholder="Leave blank if open" maxLength={128} />
              </div>
              <TextField
                label="Google review link"
                value={googleReviewUrl}
                onChange={setGoogleReviewUrl}
                placeholder="https://g.page/r/…/review"
                type="url"
                hint="In Google Business Profile, choose “Ask for reviews” and copy the link. Happy guests get sent here."
              />
            </>
          )}

          {step === 3 && (
            <>
              <h1>Bring guests back</h1>
              <p>A digital stamp card that lives on their phone. Included in your subscription.</p>
              <div className="choice-grid" style={{ marginBottom: 16 }}>
                <button type="button" className="choice" aria-pressed={loyaltyOn} onClick={() => setLoyaltyOn(true)}>
                  Yes, add a stamp card
                </button>
                <button type="button" className="choice" aria-pressed={!loyaltyOn} onClick={() => setLoyaltyOn(false)}>
                  Not now
                </button>
              </div>
              {loyaltyOn && (
                <div className="row">
                  <TextField label="Reward" value={rewardName} onChange={setRewardName} placeholder="Free coffee" maxLength={80} />
                  <Field label="Stamps needed" htmlFor="stamps">
                    <input id="stamps" className="input" type="number" min={1} max={50} value={stamps} onChange={(event) => setStamps(Math.min(50, Math.max(1, Number(event.target.value) || 1)))} />
                  </Field>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="notice notice-error" role="alert">
              {error}
            </div>
          )}

          <div className="wizard-actions">
            {step > 0 ? (
              <button type="button" className="btn" onClick={() => (setError(null), setStep((s) => s - 1))} disabled={pending}>
                <ArrowLeft aria-hidden /> Back
              </button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn btn-primary" onClick={next}>
                Next: {STEPS[step + 1]} <ArrowRight aria-hidden />
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={finish} disabled={pending}>
                {pending && <Loader2 className="spin" aria-hidden />}
                {pending ? "Creating your page…" : "Create my page"}
              </button>
            )}
          </div>
        </section>

        <aside className="ob-preview" aria-label="Preview">
          <span className="preview-label">Preview</span>
          <div className="phone">
            <div className="phone-screen" style={{ background: color }}>
              <GuestPreview name={name} tagline={tagline} color={color} palette={palette} cards={previewCards} />
            </div>
          </div>
          <p className="ob-preview-caption">This is what guests will see</p>
        </aside>
      </main>
    </div>
  );
}
