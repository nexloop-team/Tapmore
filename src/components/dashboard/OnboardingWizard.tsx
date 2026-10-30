"use client";

import { ArrowLeft, ArrowRight, Check, ImagePlus, LayoutGrid, List, Loader2, Plus, Rows4, Sparkles, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BUSINESS_TYPE_ICONS } from "@/components/catalogue-icon";
import { BrandMark } from "@/components/icons";
import { PALETTES } from "@/lib/palettes";
import { BRAND } from "@/config/brand";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { parsePrice } from "@/lib/format";
import { isLightColor } from "@/lib/theme";
import { BUSINESS_GROUPS, businessProfile, capitalise, type VenueType } from "@/lib/venue/business";
import { CURRENCIES } from "@/lib/venue/constants";
import { DEFAULT_REFERRAL_OFFERS } from "@/lib/venue/loyalty";
import { expandSocialLink } from "@/lib/venue/social";
import { whatsappLink } from "@/lib/venue/whatsapp";
import { groupSetupItems, type CreateVenueRequest } from "@/lib/venue/schema";
import { useLivePreview } from "@/lib/live-preview";
import { isIndianMenu } from "@/lib/venue/region";
import type { HeaderStyle, MenuItem, PageLayout, PublicVenue } from "@/lib/venue/types";
import { shrinkForUpload } from "./MenuAiTools";
import { Field, SwitchRow, TextField } from "./ui";


/** The catalogue step: type a few items, link to a menu that's already online, or add them later. */
type MenuChoice = "type" | "link" | "later";

/** Rows the catalogue step starts with; more are a tap away. */
const STARTING_ROWS = 3;
const MAX_ROWS = 300;
type SetupItem = NonNullable<CreateVenueRequest["items"]>[number];

/** One row of the catalogue step. Food rows also carry the café details: the veg mark, and what a photo import read. */
interface ItemRow {
  name: string;
  price: string;
  category: string;
  foodType: "" | NonNullable<MenuItem["foodType"]>;
  read: { description: string | null; allergens: NonNullable<SetupItem["allergens"]>; dietaryTags: NonNullable<SetupItem["dietaryTags"]> } | null;
}
const EMPTY_ROW: ItemRow = { name: "", price: "", category: "", foodType: "", read: null };

/** The rewards step: a stamp card, refer-a-friend offers without stamps, or nothing yet. */
type RewardsChoice = "stamps" | "referral" | "none";
const MAX_BANNERS = 5;

const LAYOUTS: { value: PageLayout; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "list", label: "List", hint: "One card per row", icon: List },
  { value: "grid", label: "Bento", hint: "Big colourful tiles", icon: LayoutGrid },
  { value: "compact", label: "Compact", hint: "Shorter rows", icon: Rows4 },
];

const HEADER_STYLES: { value: HeaderStyle; label: string }[] = [
  { value: "minimal", label: "No logo" },
  { value: "cover", label: "Logo left" },
  { value: "centered", label: "Centred" },
];

/** A photo picked during setup: uploaded once the business exists. */
interface PickedImage {
  file: File;
  preview: string;
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

export function OnboardingWizard({
  defaultCurrency,
  google,
  aiImport,
  exitHref,
  notice,
}: {
  defaultCurrency: (typeof CURRENCIES)[number];
  /** Google review replies are set up on this server, so the owner can connect their Business Profile. */
  google: boolean;
  /** AI is set up on this server: the catalogue step can read a photo of a printed menu or price list. */
  aiImport: { maxImages: number; pdf: boolean } | null;
  exitHref: string | null;
  notice?: ReactNode;
}) {
  // Compiled by the React Compiler (annotation mode, see next.config): re-renders only what an edit touches.
  "use memo";
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [venueType, setVenueType] = useState<VenueType | null>(null);
  // Words and defaults for the kind of business picked (generic until one is).
  const profile = businessProfile(venueType ?? "other");
  // The second step is named for what the business sells: "Menu", "Products", "Services".
  const STEPS = ["Business", profile.catalogue, "Look", "Online", "Rewards"];
  const [currencyCode, setCurrency] = useState(defaultCurrency);
  const [color, setColour] = useState(PALETTES[0].bg);
  const [palette, setPalette] = useState<string | null>(PALETTES[0].id);
  const setColor = (hex: string) => {
    setColour(hex);
    setPalette(null);
  };
  const [tagline, setTagline] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [logo, setLogo] = useState<PickedImage | null>(null);
  const [banners, setBanners] = useState<PickedImage[]>([]);
  const [layout, setLayout] = useState<PageLayout>("list");
  // Where the logo sits in the page header, as in Design: new pages start with "No logo" (it still marks the tab and printed cards).
  const [headerStyle, setHeaderStyle] = useState<HeaderStyle>("minimal");
  const [instagram, setInstagram] = useState<string | null>(null);
  const [referral, setReferral] = useState(true);
  const [busyText, setBusyText] = useState<string | null>(null);
  const pick = (file: File): PickedImage => ({ file, preview: URL.createObjectURL(file) });
  // Connecting Google happens right after the page is created (it needs the business to exist).
  const [connectGoogle, setConnectGoogle] = useState(google);
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string | null>(null);
  // Untouched (undefined), these follow the business type: a café starts with a stamp card for a free coffee,
  // a showroom or clinic without one, a shop with "1 stamp for every ₹500 spent".
  const [rewardsEdit, setRewards] = useState<RewardsChoice | undefined>(undefined);
  const rewards = rewardsEdit ?? (profile.stampCard ? "stamps" : "none");
  const loyaltyOn = rewards === "stamps";
  const [friendOffer, setFriendOffer] = useState<string | null>(DEFAULT_REFERRAL_OFFERS.friend);
  const [memberOffer, setMemberOffer] = useState<string | null>(DEFAULT_REFERRAL_OFFERS.member);
  const referralOffers = rewards === "referral" && friendOffer?.trim() && memberOffer?.trim() ? { friend: friendOffer.trim(), member: memberOffer.trim() } : null;
  const [rewardEdit, setRewardName] = useState<string | null | undefined>(undefined);
  const rewardName = rewardEdit === undefined ? profile.defaultReward : rewardEdit;
  const [ruleEdit, setStampRule] = useState<string | null | undefined>(undefined);
  const stampRule = ruleEdit === undefined ? profile.stampRule : ruleEdit;
  const [stamps, setStamps] = useState(9);
  const [menuChoice, setMenuChoice] = useState<MenuChoice>("type");
  const [rows, setRows] = useState<ItemRow[]>(() => Array.from({ length: STARTING_ROWS }, () => EMPTY_ROW));
  // Food and drink keep the café menu: sections and, on Indian menus, the veg mark. Shops and services list products by category.
  const food = profile.foodFields;
  const vegMarks = food && isIndianMenu(currencyCode);
  const groupWord = food ? "Section" : "Category";
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [menuUrl, setMenuUrl] = useState<string | null>(null);
  // Named rows become items. A blank price is "On request" (salons, showrooms); food needs a price.
  const typedItems = rows
    .filter((row) => row.name.trim())
    .map((row) => {
      const price = row.price.trim() ? parsePrice(row.price) : null;
      const item: SetupItem = {
        name: row.name.trim(),
        priceInPence: price ?? 0,
        priceMode: row.price.trim() ? "exact" : "on_request",
        category: row.category.trim() || null,
        ...(food ? { foodType: vegMarks ? row.foodType || null : null, description: row.read?.description ?? null, allergens: row.read?.allergens ?? [], dietaryTags: row.read?.dietaryTags ?? [] } : {}),
      };
      return { item, ok: !row.price.trim() ? !food : price !== null };
    });
  const items = menuChoice === "type" ? typedItems.filter((typed) => typed.ok).map((typed) => typed.item) : [];
  // Categories typed so far, offered as suggestions on every row.
  const categories = [...new Set(rows.map((row) => row.category.trim()).filter(Boolean))];

  /** A photo of a printed menu or price list → rows to check, in place of the empty ones. */
  async function importPhotos(files: File[]) {
    if (!files.length || !aiImport) return;
    if (files.length > aiImport.maxImages) return setError(`Choose up to ${aiImport.maxImages} photos at a time`);
    setImporting(true);
    setError(null);
    setImportNote(null);
    try {
      const { sections } = await dashboardApi.importSetupMenu(await Promise.all(files.map(shrinkForUpload)), venueType ?? "other", currencyCode);
      const found = sections.flatMap((section) =>
        section.items.map(
          (item): ItemRow => ({
            name: item.name,
            price: item.priceInPence > 0 ? String(item.priceInPence / 100) : "",
            category: sections.length > 1 ? section.name : "",
            foodType: food ? (item.foodType ?? "") : "",
            read: food ? { description: item.description ?? null, allergens: item.allergens, dietaryTags: item.dietaryTags } : null,
          }),
        ),
      );
      setRows([...rows.filter((row) => row.name.trim() || row.price.trim()), ...found].slice(0, MAX_ROWS));
      const allergenNote = found.some((row) => row.read?.allergens.length) ? " Allergens the AI found are worth a check on the Menu page later." : "";
      setImportNote(`Found ${found.length} ${found.length === 1 ? profile.item : profile.items}. Check the names and prices below.${allergenNote}`);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setImporting(false);
    }
  }

  function validateStep(): string | null {
    if (step === 0 && !name.trim()) return "Give your business a name";
    if (step === 0 && !venueType) return "Pick what kind of business it is";
    if (step === 0 && profile.booking && whatsapp?.trim() && !whatsappLink(whatsapp, currencyCode)) return "Enter a WhatsApp number, like 98765 43210";
    if (step === 0 && phone?.trim() && !/^\+?[\d\s()-]{6,20}$/.test(phone.trim())) return "Enter a phone number, like 98765 43210";
    if (step === 1 && menuChoice === "type") {
      const bad = typedItems.find((typed) => !typed.ok)?.item;
      if (bad) return profile.foodFields ? `Add a price for ${bad.name}, like 120 or 4.50` : `Check the price for ${bad.name}: a number like 499, or leave it blank for “On request”`;
      if (rows.some((row) => !row.name.trim() && row.price.trim())) return `Give every ${profile.item} with a price a name`;
    }
    if (step === 1 && menuChoice === "link" && !/^https?:\/\/\S+\.\S+/i.test(menuUrl?.trim() ?? "")) return `Paste the link to your ${profile.catalogue.toLowerCase()}, starting with https://`;
    if (step === 3 && !connectGoogle && googleReviewUrl?.trim() && !/^https?:\/\//i.test(googleReviewUrl.trim())) return "The Google review link must start with https://";
    if (step === 4 && loyaltyOn && !rewardName?.trim()) return `Name the reward ${profile.people} collect stamps for`;
    if (step === 4 && rewards === "referral" && !referralOffers) return "Say what the friend and the member who invited them get";
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
      venueType: venueType ?? "other",
      currencyCode,
      backgroundColorHex: color,
      palette,
      tagline,
      // Connecting Google fills the review link in from the profile itself.
      googleReviewUrl: connectGoogle ? null : googleReviewUrl?.trim() || null,
      bookingUrl: profile.booking ? whatsappLink(whatsapp, currencyCode) : null,
      phone: phone?.trim() || null,
      whatsapp: profile.booking && whatsappLink(whatsapp, currencyCode) ? whatsapp!.trim() : null,
      instagram: expandSocialLink("instagram", instagram),
      layout,
      menuUrl: menuChoice === "link" ? menuUrl?.trim() || null : null,
      items: items.length ? items : null,
      loyalty: loyaltyOn && rewardName ? { rewardName: rewardName.trim(), stampsRequired: stamps, stampRule: stampRule?.trim() || null, referral } : null,
      referralOffers,
    };
    try {
      const venue = await dashboardApi.createVenue(body);
      if (logo || banners.length) {
        // Photos need the business to exist; a failed upload never stops setup (they can be added in Design).
        setBusyText("Adding your photos…");
        try {
          const logoUrl = logo ? await dashboardApi.uploadImage(venue.id, logo.file, "logo") : null;
          const bannerUrls: string[] = [];
          for (const banner of banners) bannerUrls.push(await dashboardApi.uploadImage(venue.id, banner.file, "cover"));
          const saved = await dashboardApi.updateVenue(venue.id, {});
          await dashboardApi.updateVenue(venue.id, {
            config: {
              branding: {
                ...saved.config!.branding!,
                ...(logoUrl ? { logoUrl, headerStyle } : {}),
                ...(bannerUrls.length ? { coverImageUrls: bannerUrls, coverImageUrl: bannerUrls[0] } : {}),
              },
            },
          });
        } catch (err) {
          console.error("Setup photo upload failed", err);
        }
      }
      // Straight on to Google's sign-in (a full page load: the route redirects off-site), back to the Google reviews page after.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- an API route that redirects to Google, not a page
      if (connectGoogle) window.location.assign(`/api/google/connect?venue=${encodeURIComponent(venue.id)}`);
      else router.replace(`/dashboard/${venue.id}?welcome=1`);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
      setBusyText(null);
    }
  }

  // The real guest page in the phone, showing these answers (picked photos too) before anything is saved.
  const booking = profile.booking ? whatsappLink(whatsapp, currencyCode) : null;
  const reviewLink = googleReviewUrl?.trim() || (connectGoogle ? "https://g.page/r/your-business/review" : null);
  const previewDraft: Partial<PublicVenue> = {
    name: name.trim() || "Your business",
    venueType: venueType ?? "other",
    currencyCode,
    phone: phone?.trim() || null,
    whatsapp: profile.booking && whatsappLink(whatsapp, currencyCode) ? whatsapp!.trim() : null,
    wifi: null,
    // The catalogue card in its place, with what's been typed so far.
    menus: [
      {
        id: "menu_preview",
        name: profile.catalogue,
        ...(profile.linkToken === "view_menu" ? {} : { linkLabelToken: profile.linkToken }),
        externalUrl: menuChoice === "link" ? menuUrl?.trim() || null : null,
        sections: groupSetupItems(
          items.map((item, index) => ({ ...item, id: `itm_preview_${index}` })),
          profile.catalogue,
        ).map((group, index) => ({
          id: `sec_preview_${index}`,
          name: group.name,
          sortOrder: index,
          items: group.items.map((item) => ({ ...item, category: undefined, isAvailable: true, allergens: item.allergens ?? [], dietaryTags: item.dietaryTags ?? [] })),
        })),
      },
    ],
    socialLinks: { google: step >= 3 ? reviewLink : null, instagram: expandSocialLink("instagram", instagram) },
    externalLinks: booking ? [{ id: "lnk_preview_book", url: booking, labelToken: "book_now", icon: "calendar" }] : [],
    loyaltyProgram:
      step >= 4 && referralOffers
        ? { rewardName: "", stampsRequired: 0, stampsEnabled: false, referralOffers }
        : step >= 4 && loyaltyOn && rewardName?.trim()
          ? { rewardName: rewardName.trim(), stampsRequired: stamps, stampRule: stampRule?.trim() || null, ...(referral ? { referral: { enabled: true, referrerStamps: 2, friendStamps: 1 } } : {}) }
          : null,
    branding: {
      backgroundColorHex: color,
      palette,
      tagline,
      logoUrl: logo?.preview ?? null,
      headerStyle: logo ? headerStyle : "minimal",
      coverImageUrls: banners.map((banner) => banner.preview),
      coverImageUrl: banners[0]?.preview ?? null,
      layout: layout === "list" ? null : layout,
      showGoogleReviewButton: step >= 3 && !!reviewLink,
      sudokuEnabled: profile.sudoku,
    },
    crm: { enabled: false, wifiCapture: false, feedbackCapture: false, birthdayAsk: false },
    announcement: null,
  };
  useLivePreview(previewDraft);

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
              <h1>Tell us about your business</h1>
              <p>This is what {profile.people} see at the top of your page.</p>
              <TextField label="Business name" value={name} onChange={(v) => setName(v ?? "")} placeholder={`e.g. ${profile.namePlaceholder}`} maxLength={80} required />
              <div className="field">
                <span className="field-label" id="business-type-label">
                  What kind of business is it?
                </span>
                {/* One compact grid, in group order (food, shops, services); the picked type's examples show underneath. */}
                <div className="business-type-grid" role="group" aria-labelledby="business-type-label">
                  {BUSINESS_GROUPS.flatMap((group) => group.types).map((type) => {
                    const option = businessProfile(type);
                    const Icon = BUSINESS_TYPE_ICONS[type];
                    return (
                      <button key={type} type="button" className="choice type-choice" aria-pressed={venueType === type} title={option.hint} onClick={() => setVenueType(type)}>
                        <Icon aria-hidden />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="hint type-picked">
                  {venueType ? `${businessProfile(venueType).hint}. ` : "Not listed? Pick the closest. "}
                  You can change it later in Settings.
                </p>
              </div>
              <div className="row">
                <Field label="Phone number (optional)" htmlFor="phone" hint="Adds a “Call” button to your page.">
                  <input id="phone" className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="e.g. 98765 43210" value={phone ?? ""} maxLength={20} onChange={(event) => setPhone(event.target.value)} />
                </Field>
                {profile.booking && (
                  <Field label="WhatsApp for bookings (optional)" htmlFor="whatsapp" hint="Adds a “Book now” button that opens a chat.">
                    <span className="input-prefix">
                      {currencyCode === "INR" && <span aria-hidden>+91</span>}
                      <input id="whatsapp" className="input" type="tel" inputMode="tel" placeholder="e.g. 98765 43210" value={whatsapp ?? ""} maxLength={20} onChange={(event) => setWhatsapp(event.target.value)} />
                    </span>
                  </Field>
                )}
              </div>
              {currencyOpen ? (
                <Field label="Currency for prices" htmlFor="currency">
                  <select id="currency" className="select" value={currencyCode} onChange={(event) => setCurrency(event.target.value as typeof currencyCode)}>
                    {CURRENCIES.map((code) => (
                      <option key={code}>{code}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="hint">
                  Prices in {currencyCode}.{" "}
                  <button type="button" className="link-button" onClick={() => setCurrencyOpen(true)}>
                    Change
                  </button>
                </p>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <h1>Your {profile.catalogue.toLowerCase()}</h1>
              <p>
                Add your {profile.items} with prices so {profile.people} can see what you offer. Group them by {groupWord.toLowerCase()} if you like. Photos and more can be
                added later.
              </p>
              <div className="choice-grid" style={{ marginBottom: 16 }}>
                <button type="button" className="choice" aria-pressed={menuChoice === "type"} onClick={() => setMenuChoice("type")}>
                  Add them now
                </button>
                <button type="button" className="choice" aria-pressed={menuChoice === "link"} onClick={() => setMenuChoice("link")}>
                  It&apos;s already online
                </button>
                <button type="button" className="choice" aria-pressed={menuChoice === "later"} onClick={() => setMenuChoice("later")}>
                  Later
                </button>
              </div>
              {menuChoice === "type" && (
                <div className={`ob-items${vegMarks ? " ob-items-veg" : ""}`}>
                  {aiImport && (
                    <div className="ob-import">
                      <label className={`btn btn-sm${importing ? " is-disabled" : ""}`}>
                        {importing ? <Loader2 className="spin" aria-hidden /> : <Sparkles aria-hidden />}
                        {importing ? "Reading your photo…" : "Import from a photo"}
                        <input
                          type="file"
                          accept={aiImport.pdf ? "image/jpeg,image/png,image/webp,application/pdf" : "image/jpeg,image/png,image/webp"}
                          multiple
                          className="visually-hidden"
                          disabled={importing}
                          onChange={(event) => {
                            void importPhotos(Array.from(event.target.files ?? []));
                            event.target.value = "";
                          }}
                        />
                      </label>
                      <span className="hint">
                        {importing
                          ? "This can take up to a minute."
                          : `Have a printed ${profile.foodFields ? "menu" : "price list"}? Take a photo and AI fills in the list below for you to check.`}
                      </span>
                    </div>
                  )}
                  {importNote && (
                    <div className="notice notice-ok" role="status">
                      {importNote}
                    </div>
                  )}
                  <div className="ob-item-head" aria-hidden>
                    <span>{capitalise(profile.item)}</span>
                    <span>{groupWord}</span>
                    <span>Price ({currencyCode})</span>
                    {vegMarks && <span>Veg?</span>}
                  </div>
                  <datalist id="ob-categories">
                    {categories.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                  {rows.map((row, index) => (
                    <div key={index} className="ob-item">
                      <input
                        className="input"
                        aria-label={`${capitalise(profile.item)} ${index + 1}`}
                        placeholder={index === 0 ? `e.g. ${profile.itemPlaceholder}` : ""}
                        value={row.name}
                        maxLength={120}
                        onChange={(event) => setRows(rows.map((r, i) => (i === index ? { ...r, name: event.target.value } : r)))}
                      />
                      <input
                        className="input"
                        aria-label={`${groupWord} of ${profile.item} ${index + 1}`}
                        list="ob-categories"
                        placeholder={index === 0 ? `e.g. ${profile.sectionPlaceholder.split(" or ")[0]}` : "Optional"}
                        value={row.category}
                        maxLength={120}
                        onChange={(event) => setRows(rows.map((r, i) => (i === index ? { ...r, category: event.target.value } : r)))}
                      />
                      <input
                        className="input"
                        aria-label={`Price of ${profile.item} ${index + 1}`}
                        inputMode="decimal"
                        placeholder={profile.foodFields ? "e.g. 120" : "e.g. 499, or blank"}
                        value={row.price}
                        maxLength={14}
                        onChange={(event) => setRows(rows.map((r, i) => (i === index ? { ...r, price: event.target.value } : r)))}
                      />
                      {vegMarks && (
                        <select
                          className="select"
                          aria-label={`Veg or non-veg, ${profile.item} ${index + 1}`}
                          value={row.foodType}
                          onChange={(event) => setRows(rows.map((r, i) => (i === index ? { ...r, foodType: event.target.value as ItemRow["foodType"] } : r)))}
                        >
                          <option value="">–</option>
                          <option value="veg">Veg</option>
                          <option value="nonveg">Non-veg</option>
                          <option value="egg">Egg</option>
                        </select>
                      )}
                      <button type="button" className="ob-item-remove" aria-label={`Remove ${profile.item} ${index + 1}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, i) => i !== index))}>
                        <X aria-hidden />
                      </button>
                    </div>
                  ))}
                  {rows.length < MAX_ROWS && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRows([...rows, { ...EMPTY_ROW, category: rows[rows.length - 1]?.category ?? "" }])}>
                      <Plus aria-hidden /> Add another
                    </button>
                  )}
                  <p className="hint">
                    {food ? "" : "Leave the price blank to show “On request”. "}Without a {groupWord.toLowerCase()}, {profile.items} go under “{profile.catalogue}”.
                    {food && " Descriptions, photos and allergens can be added on the Menu page."}
                  </p>
                </div>
              )}
              {menuChoice === "link" && (
                <TextField
                  label={`Link to your ${profile.catalogue.toLowerCase()}`}
                  value={menuUrl}
                  onChange={setMenuUrl}
                  placeholder="https://"
                  type="url"
                  hint={`A website, Google Drive PDF or online store page. The “${profile.catalogue}” button on your page opens it.`}
                />
              )}
              {menuChoice === "later" && (
                <p className="hint">No problem. The {profile.catalogue} button shows on your page once you add something, from the {profile.catalogue} page in your dashboard.</p>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h1>Make it look like {name.trim() || `your ${profile.noun}`}</h1>
              <p>A logo and a photo or two make the page feel like yours. Everything here can be changed later.</p>
              <div className="ob-images">
                <div className="field">
                  <span className="field-label">Logo</span>
                  {logo ? (
                    <span className="ob-thumb ob-thumb-logo">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of a picked file */}
                      <img src={logo.preview} alt="Your logo" />
                      <button type="button" className="ob-thumb-remove" aria-label="Remove logo" onClick={() => setLogo(null)}>
                        <X aria-hidden />
                      </button>
                    </span>
                  ) : (
                    <label className="ob-add ob-add-logo">
                      <ImagePlus aria-hidden />
                      <span>Add logo</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" onChange={(event) => event.target.files?.[0] && setLogo(pick(event.target.files[0]))} />
                    </label>
                  )}
                </div>
                <div className="field">
                  <span className="field-label">Banner photos (up to {MAX_BANNERS})</span>
                  <div className="ob-banners">
                    {banners.map((banner, index) => (
                      <span key={banner.preview} className="ob-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of a picked file */}
                        <img src={banner.preview} alt={`Banner ${index + 1}`} />
                        <button type="button" className="ob-thumb-remove" aria-label={`Remove banner ${index + 1}`} onClick={() => setBanners(banners.filter((_, i) => i !== index))}>
                          <X aria-hidden />
                        </button>
                      </span>
                    ))}
                    {banners.length < MAX_BANNERS && (
                      <label className="ob-add">
                        <ImagePlus aria-hidden />
                        <span>{banners.length ? "Add" : "Add photos"}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="visually-hidden"
                          onChange={(event) => {
                            const files = Array.from(event.target.files ?? []).slice(0, MAX_BANNERS - banners.length);
                            setBanners([...banners, ...files.map(pick)]);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <span className="hint">Landscape photos of your place, products or an offer. More than one take turns.</span>
                </div>
              </div>
              {logo && (
                <div className="field">
                  <span className="field-label" id="ob-header-label">
                    Logo on the page
                  </span>
                  <div className="segmented" role="group" aria-labelledby="ob-header-label">
                    {HEADER_STYLES.map((option) => (
                      <button key={option.value} type="button" aria-pressed={headerStyle === option.value} onClick={() => setHeaderStyle(option.value)}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="field">
                <span className="field-label" id="ob-layout-label">
                  Layout
                </span>
                <div className="ob-layouts" role="group" aria-labelledby="ob-layout-label">
                  {LAYOUTS.map((option) => (
                    <button key={option.value} type="button" className="choice ob-layout" aria-pressed={layout === option.value} onClick={() => setLayout(option.value)}>
                      <option.icon aria-hidden />
                      <span>
                        <strong>{option.label}</strong>
                        <span>{option.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
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
                  <span className="hint">Paste a hex code from your sign or logo</span>
                </span>
                <div className="ob-own">
                  <input className="color-input" type="color" aria-label="Pick a custom colour" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} />
                  <HexField value={color} onChange={setColor} />
                  <span className="ob-readable">
                    <Check aria-hidden /> Readable with {isLightColor(color) ? "dark" : "white"} text
                  </span>
                </div>
              </div>
              <TextField label="Tagline (optional)" value={tagline} onChange={setTagline} placeholder="e.g. Your neighbourhood favourite" maxLength={120} />
            </>
          )}

          {step === 3 && (
            <>
              <h1>Google reviews and Instagram</h1>
              <p>More reviews bring more {profile.people}. Your page invites people to leave one, and {BRAND.name} can help you answer them.</p>
              {google && (
                <div className="ob-google">
                  <button type="button" className="choice ob-google-choice" aria-pressed={connectGoogle} onClick={() => setConnectGoogle(true)}>
                    <strong>Connect my Google Business Profile</strong>
                    <span>Your review link is set up for you, new reviews arrive in your dashboard, and replies are drafted with AI. Takes a minute after this step.</span>
                  </button>
                  <button type="button" className="choice ob-google-choice" aria-pressed={!connectGoogle} onClick={() => setConnectGoogle(false)}>
                    <strong>Not now</strong>
                    <span>You can connect it any time from Google reviews in your dashboard.</span>
                  </button>
                </div>
              )}
              {google && connectGoogle ? (
                <p className="hint">Use the Google account that owns or manages your business on Google Maps. Your review link is added for you.</p>
              ) : (
                <TextField
                  label="Google review link (optional)"
                  value={googleReviewUrl}
                  onChange={setGoogleReviewUrl}
                  placeholder="https://g.page/r/…/review"
                  type="url"
                  hint="In your Google Business Profile, tap “Ask for reviews” and copy the link. It adds a “Leave a Google review” button."
                />
              )}
              <TextField
                label="Instagram (optional)"
                value={instagram}
                onChange={setInstagram}
                placeholder="e.g. @yourbusiness"
                maxLength={200}
                hint="Shown as an icon at the bottom of your page."
              />
            </>
          )}

          {step === 4 && (
            <>
              <h1>Bring {profile.people} back</h1>
              <p>A card that lives on their phone: collect stamps, or just invite friends for a discount. Included in your subscription.</p>
              {profile.professionalRules && (
                <p className="hint">Check your professional and legal rules before offering rewards. Many {profile.noun}s don&apos;t, and you can add a card later.</p>
              )}
              <div className="choice-grid" style={{ marginBottom: 16 }}>
                <button type="button" className="choice" aria-pressed={rewards === "stamps"} onClick={() => setRewards("stamps")}>
                  Stamp card
                </button>
                <button type="button" className="choice" aria-pressed={rewards === "referral"} onClick={() => setRewards("referral")}>
                  Refer a friend only
                </button>
                <button type="button" className="choice" aria-pressed={rewards === "none"} onClick={() => setRewards("none")}>
                  Not now
                </button>
              </div>
              {rewards === "referral" && (
                <>
                  <p className="hint" style={{ marginBottom: 12 }}>
                    No stamps. Members share an invite link; a friend who joins gets a welcome offer on their first visit, and the member gets a reward for each friend who comes in.
                  </p>
                  <TextField label="The friend gets, on their first visit" value={friendOffer} onChange={setFriendOffer} placeholder={`e.g. ${DEFAULT_REFERRAL_OFFERS.friend}`} maxLength={80} />
                  <TextField
                    label="The member who invited them gets"
                    value={memberOffer}
                    onChange={setMemberOffer}
                    placeholder={`e.g. ${DEFAULT_REFERRAL_OFFERS.member}`}
                    maxLength={80}
                    hint="Staff give both by scanning the member's card."
                  />
                </>
              )}
              {loyaltyOn && (
                <>
                  <div className="row">
                    <TextField label="Reward" value={rewardName} onChange={setRewardName} placeholder={profile.defaultReward ? `e.g. ${profile.defaultReward}` : "e.g. 10% off your next visit"} maxLength={80} />
                    <Field label="Stamps needed" htmlFor="stamps">
                      <input id="stamps" className="input" type="number" min={1} max={50} value={stamps} onChange={(event) => setStamps(Math.min(50, Math.max(1, Number(event.target.value) || 1)))} />
                    </Field>
                  </div>
                  <TextField
                    label="How a stamp is earned (optional)"
                    value={stampRule}
                    onChange={setStampRule}
                    placeholder="e.g. 1 stamp for every ₹500 spent"
                    maxLength={80}
                    hint="Shown on the card and at the till, so everyone knows the rule."
                  />
                  <SwitchRow
                    title="Refer a friend"
                    description={`Members get 2 stamps when a friend they invite makes a first visit, and the friend starts with 1. You can change the numbers later.`}
                    checked={referral}
                    onChange={setReferral}
                  />
                </>
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
                {pending ? (busyText ?? "Creating your page…") : connectGoogle ? "Create my page and connect Google" : "Create my page"}
              </button>
            )}
          </div>
        </section>

        <aside className="ob-preview" aria-label="Preview">
          <span className="preview-label">Live preview</span>
          <div className="phone">
            <div className="phone-screen">
              {/* The real page (a demo underneath), showing these answers through the live preview. */}
              <iframe data-live-preview src="/s?i=demo&s=preview&embed=1" title="Live preview of your page" />
            </div>
          </div>
          <p className="ob-preview-caption">This is your real page. Your {profile.items} show here once you add them.</p>
        </aside>
      </main>
    </div>
  );
}
