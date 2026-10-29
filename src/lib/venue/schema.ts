import { z } from "zod";
import { LINK_ICON_TOKENS } from "@/components/icons";
import { businessProfile } from "./business";
import { ALLERGENS, CURRENCIES, DIETARY_TAGS, FOOD_TYPES, LINK_LABEL_TOKENS, MENU_BADGES, VENUE_TYPES } from "./constants";

/**
 * What a merchant may save from the dashboard. Every field the guest page
 * renders passes through here first, so URLs are http(s) or same-origin,
 * colours are hex, and text has a ceiling.
 */

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).nullish();
const id = z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/, "Invalid id");

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => /^https?:\/\/[^\s]+$/i.test(value), "Links must start with https://");
const optionalUrl = z.union([httpUrl, z.literal("")]).nullish().transform((value) => value || null);

/** Uploaded media (/media/...) or an http(s) URL. */
const imageUrl = z
  .union([z.string().trim().regex(/^\/(media|demo)\/[A-Za-z0-9/_.-]+$/, "Invalid image"), httpUrl, z.literal("")])
  .nullish()
  .transform((value) => value || null);

/** A gallery entry: like imageUrl, but never empty. */
const imageUrlItem = z.union([z.string().trim().regex(/^\/(media|demo)\/[A-Za-z0-9/_.-]+$/, "Invalid image"), httpUrl]);

/** A phone number as people write it: digits, spaces, dashes, brackets and an optional leading +. */
const phoneNumber = z
  .string()
  .trim()
  .max(20)
  .regex(/^\+?[\d\s()-]{6,20}$/, "Enter a phone number, like 98765 43210")
  .or(z.literal(""))
  .nullish()
  .transform((value) => value || null);

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Colours must look like #1A2B3C")
  .nullish();

export { ALLERGENS, CURRENCIES, DIETARY_TAGS, FOOD_TYPES, LINK_LABEL_TOKENS, MENU_BADGES, VENUE_TYPES };

export const menuItemSchema = z.object({
  id,
  name: text(120).min(1, "Every item needs a name"),
  description: optionalText(500),
  // Up to ₹10 crore: showrooms sell furniture, vehicles and jewellery.
  priceInPence: z.number().int().min(0).max(1_000_000_000),
  /** "From ₹499" or "Price on request" instead of an exact price (jewellery, salon services, clinics). */
  priceMode: z.enum(["exact", "from", "on_request"]).nullish(),
  isAvailable: z.boolean(),
  allergens: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length),
  dietaryTags: z.array(z.enum(DIETARY_TAGS)).max(DIETARY_TAGS.length),
  foodType: z.enum(FOOD_TYPES).nullish(),
  calories: z.number().int().min(0).max(10_000).nullish(),
  imageUrl,
  /** "What's this?" text for unfamiliar dishes; written or approved by the owner. */
  explainer: optionalText(600),
  badges: z.array(z.enum(MENU_BADGES)).max(MENU_BADGES.length).optional(),
  /** Shown in the "Today's specials" strip at the top of the menu. */
  featured: z.boolean().optional(),
});

export const menuSectionSchema = z.object({
  id,
  name: text(120).min(1, "Every section needs a name"),
  description: optionalText(140),
  sortOrder: z.number().int().min(0).max(1000),
  items: z.array(menuItemSchema).max(300),
});

export const menuSchema = z.object({
  id,
  name: text(80).min(1, "Every menu needs a name"),
  externalUrl: optionalUrl,
  linkLabelToken: z.enum(LINK_LABEL_TOKENS).nullish(),
  linkLabelCustom: optionalText(60),
  welcomeText: optionalText(200),
  primaryColorHex: hexColor,
  showCalories: z.boolean().nullish(),
  layout: z.enum(["list", "photo", "classic", "simple"]).nullish(),
  /** Shops and services: an "Ask/Book on WhatsApp" button on each item, for a page shared online. Off unless turned on. */
  askWhatsapp: z.boolean().nullish(),
  sections: z.array(menuSectionSchema).max(50),
});

export const externalLinkSchema = z.object({
  id,
  url: httpUrl,
  labelToken: z.enum(LINK_LABEL_TOKENS).nullish(),
  labelCustom: optionalText(60),
  icon: z.enum(LINK_ICON_TOKENS).nullish(),
});

export const brandingSchema = z.object({
  coverImageUrl: imageUrl,
  /** Up to 5 banner photos that take turns at the top of the page; coverImageUrl mirrors the first. */
  coverImageUrls: z.array(imageUrlItem).max(5).optional(),
  logoUrl: imageUrl,
  titleOverride: z.string().max(80).nullish(),
  tagline: optionalText(120),
  backgroundColorHex: hexColor,
  palette: z.string().trim().max(40).nullish(),
  tileColorHex: hexColor,
  tileAccentHex: hexColor,
  tileSource: z.enum(["logo", "page", "custom"]).nullish(),
  appearance: z.enum(["light", "dark"]).nullish(),
  style: z.enum(["classic", "editorial", "modern"]).nullish(),
  showGoogleReviewButton: z.boolean().optional(),
  sudokuEnabled: z.boolean().optional(),
  featureOrder: z.array(z.string().max(60)).max(40).optional(),
  hiddenFeatures: z.array(z.string().max(60)).max(40).optional(),
  featureLabels: z.partialRecord(z.enum(["loyalty", "menu", "wifi", "sudoku", "feedback", "google_review"]), z.string().trim().max(40)).optional(),
  layout: z.enum(["list", "grid", "compact"]).nullish(),
  headerStyle: z.enum(["cover", "centered", "minimal"]).nullish(),
  buttonShape: z.enum(["rounded", "pill", "square"]).nullish(),
  socialStyle: z.enum(["icons", "cards"]).nullish(),
});

export const socialLinksSchema = z.object({
  google: optionalUrl,
  facebook: optionalUrl,
  instagram: optionalUrl,
  tripAdvisor: optionalUrl,
  youtube: optionalUrl,
});

export const wifiSchema = z
  .object({
    ssid: text(64),
    password: optionalText(128),
    security: z.enum(["WPA2", "WPA3", "WPA", "WEP", "open"]).nullish(),
  })
  .nullish();

export const loyaltySchema = z
  .object({
    rewardName: text(80),
    stampsRequired: z.number().int().min(0).max(50),
    stampsEnabled: z.boolean().optional(),
    /** How a stamp is earned, e.g. "1 stamp for every ₹500 spent": shown on the card and the till; staff still decide. */
    stampRule: optionalText(80),
    rewardTiers: z
      .array(z.object({ rewardName: text(80).min(1), stampsRequired: z.number().int().min(1).max(50) }))
      .max(5)
      .optional(),
    referral: z
      .object({
        enabled: z.boolean(),
        /** Stamps for the member who invited, once the friend's first visit is stamped. */
        referrerStamps: z.number().int().min(1).max(3),
        /** Welcome stamps for the friend when they join through the invite. */
        friendStamps: z.number().int().min(0).max(2),
      })
      .optional(),
    /** "Refer a friend" without stamps: what an invited friend gets on their first visit, and what the inviter gets for it. */
    referralOffers: z.object({ friend: text(80).min(1, "Say what the friend gets"), member: text(80).min(1, "Say what the member gets") }).optional(),
  })
  .nullish()
  .superRefine((value, ctx) => {
    if (!value || value.stampsEnabled === false) return;
    if (!value.rewardName) ctx.addIssue({ code: "custom", message: "Name the reward guests are collecting for" });
    if (value.stampsRequired < 1) ctx.addIssue({ code: "custom", message: "A stamp card needs at least one stamp" });
  });

export const crmSchema = z.object({
  enabled: z.boolean(),
  wifiCapture: z.boolean(),
  feedbackCapture: z.boolean(),
  birthdayAsk: z.boolean(),
});

/** The stored venue configuration (everything except id and short code). */
export const venueConfigSchema = z.object({
  name: text(80).min(1, "Your business needs a name"),
  venueType: z.enum(VENUE_TYPES).nullish(),
  currencyCode: z.enum(CURRENCIES),
  /** Shown as a "Call" button on the page. */
  phone: phoneNumber,
  /** For "Ask on WhatsApp" on products and services (and the "Book now" button set up with it). */
  whatsapp: phoneNumber,
  wifi: wifiSchema,
  socialLinks: socialLinksSchema,
  menus: z.array(menuSchema).max(10),
  loyaltyProgram: loyaltySchema,
  branding: brandingSchema,
  externalLinks: z.array(externalLinkSchema).max(12),
  crm: crmSchema,
  announcement: z
    .object({
      text: text(160).min(1, "Write the announcement or remove it"),
      /** Last day it shows (YYYY-MM-DD, venue-local); empty means until removed. */
      until: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date")
        .nullish(),
    })
    .nullish(),
});

/** The editable shape; saved configs are always the schema's parse of one of these. */
export type VenueConfig = z.input<typeof venueConfigSchema>;

/** A dashboard save replaces whole top-level sections, never fields inside one. */
export const venueConfigPatch = venueConfigSchema.partial();
export type VenueConfigPatch = z.input<typeof venueConfigPatch>;

/** Lower-case letters, digits and single hyphens; printed into every QR code. */
export const shortCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, "Use 3-40 lower-case letters, numbers and hyphens");

export const createVenueRequest = z.object({
  name: text(80).min(1, "Your business needs a name"),
  venueType: z.enum(VENUE_TYPES),
  currencyCode: z.enum(CURRENCIES),
  backgroundColorHex: hexColor,
  palette: z.string().trim().max(40).nullish(),
  tagline: optionalText(120),
  wifi: wifiSchema,
  googleReviewUrl: optionalUrl,
  menuUrl: optionalUrl,
  /** A few items typed in during setup; the rest are added (or imported from a photo) on the menu page. */
  items: z
    .array(
      z.object({
        name: text(120).min(1),
        priceInPence: z.number().int().min(0).max(1_000_000_000),
        priceMode: z.enum(["exact", "from", "on_request"]).nullish(),
        /** "Hair", "Shirts": items with the same category become one section. */
        category: optionalText(120),
        // Food and drink only (ignored for other businesses): the café menu's details, typed or read from a photo.
        description: optionalText(500),
        foodType: z.enum(FOOD_TYPES).nullish(),
        allergens: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length).optional(),
        dietaryTags: z.array(z.enum(DIETARY_TAGS)).max(DIETARY_TAGS.length).optional(),
      }),
    )
    .max(300)
    .nullish(),
  /** Appointment businesses (salons, clinics, gyms): their booking page, added as a "Book now" card. */
  bookingUrl: optionalUrl,
  phone: phoneNumber,
  whatsapp: phoneNumber,
  instagram: optionalUrl,
  layout: z.enum(["list", "grid", "compact"]).nullish(),
  loyalty: z
    .object({ rewardName: text(80).min(1), stampsRequired: z.number().int().min(1).max(50), stampRule: optionalText(80), referral: z.boolean().optional() })
    .nullish(),
  /** "Refer a friend" only: no stamp card, just these two offers. Takes the place of `loyalty`. */
  referralOffers: z.object({ friend: text(80).min(1), member: text(80).min(1) }).nullish(),
});
export type CreateVenueRequest = z.input<typeof createVenueRequest>;

export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
}

type SetupItem = NonNullable<z.output<typeof createVenueRequest>["items"]>[number];

/** Setup items as sections, one per category in the order first used; items without one go under `fallback` ("Products"). */
export function groupSetupItems<T extends Pick<SetupItem, "category">>(items: T[], fallback: string): { name: string; items: T[] }[] {
  const groups = new Map<string, { name: string; items: T[] }>();
  for (const item of items) {
    const name = item.category?.trim() || fallback;
    const key = name.toLowerCase();
    if (!groups.has(key)) groups.set(key, { name, items: [] });
    groups.get(key)!.items.push(item);
  }
  return [...groups.values()];
}

/** A fresh venue from the onboarding answers: sensible defaults, nothing broken. */
export function initialVenueConfig(input: z.output<typeof createVenueRequest>, newId: (prefix: string) => string): VenueConfig {
  // A shop starts with "Products", a salon with "Services": the menu's name and card label follow the business.
  const profile = businessProfile(input.venueType);
  const label = profile.linkToken === "view_menu" ? {} : { linkLabelToken: profile.linkToken };
  const menus: VenueConfig["menus"] = input.menuUrl
    ? [{ id: newId("menu"), name: profile.catalogue, externalUrl: input.menuUrl, linkLabelToken: profile.linkToken, sections: [] }]
    : [
        {
          id: newId("menu"),
          name: profile.catalogue,
          ...label,
          sections: groupSetupItems(input.items ?? [], profile.catalogue).map((group, index) => ({
            id: newId("sec"),
            name: group.name,
            sortOrder: index,
            items: group.items.map((item) => ({
              id: newId("itm"),
              name: item.name,
              priceInPence: item.priceInPence,
              ...(item.priceMode && item.priceMode !== "exact" ? { priceMode: item.priceMode } : {}),
              isAvailable: true,
              allergens: profile.foodFields ? (item.allergens ?? []) : [],
              dietaryTags: profile.foodFields ? (item.dietaryTags ?? []) : [],
              ...(profile.foodFields && item.description ? { description: item.description } : {}),
              ...(profile.foodFields && item.foodType ? { foodType: item.foodType } : {}),
            })),
          })),
        },
      ];
  return {
    name: input.name,
    venueType: input.venueType,
    currencyCode: input.currencyCode,
    wifi: input.wifi?.ssid ? input.wifi : null,
    socialLinks: { google: input.googleReviewUrl ?? null, instagram: input.instagram ?? null },
    menus,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    loyaltyProgram: input.referralOffers
      ? { rewardName: "", stampsRequired: 0, stampsEnabled: false, referralOffers: input.referralOffers }
      : input.loyalty
      ? {
          rewardName: input.loyalty.rewardName,
          stampsRequired: input.loyalty.stampsRequired,
          ...(input.loyalty.stampRule ? { stampRule: input.loyalty.stampRule } : {}),
          // Refer a friend: 2 stamps to the member once their friend's first visit is stamped, 1 welcome stamp for the friend.
          ...(input.loyalty.referral ? { referral: { enabled: true, referrerStamps: 2, friendStamps: 1 } } : {}),
        }
      : null,
    branding: {
      backgroundColorHex: input.backgroundColorHex ?? "#FFFFFF",
      palette: input.palette ?? null,
      tagline: input.tagline ?? null,
      showGoogleReviewButton: !!input.googleReviewUrl,
      sudokuEnabled: profile.sudoku,
      ...(input.layout && input.layout !== "list" ? { layout: input.layout } : {}),
    },
    externalLinks: input.bookingUrl ? [{ id: newId("lnk"), url: input.bookingUrl, labelToken: "book_now", icon: "calendar" }] : [],
    crm: { enabled: false, wifiCapture: false, feedbackCapture: false, birthdayAsk: false },
  };
}
