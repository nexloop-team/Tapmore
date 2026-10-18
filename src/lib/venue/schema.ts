import { z } from "zod";
import { LINK_ICON_TOKENS } from "@/components/icons";
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
  priceInPence: z.number().int().min(0).max(10_000_000),
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
  layout: z.enum(["list", "photo", "classic"]).nullish(),
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
  name: text(80).min(1, "Your venue needs a name"),
  venueType: z.enum(VENUE_TYPES).nullish(),
  currencyCode: z.enum(CURRENCIES),
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
  name: text(80).min(1, "Your venue needs a name"),
  venueType: z.enum(VENUE_TYPES),
  currencyCode: z.enum(CURRENCIES),
  backgroundColorHex: hexColor,
  palette: z.string().trim().max(40).nullish(),
  tagline: optionalText(120),
  wifi: wifiSchema,
  googleReviewUrl: optionalUrl,
  menuUrl: optionalUrl,
  loyalty: z.object({ rewardName: text(80).min(1), stampsRequired: z.number().int().min(1).max(50) }).nullish(),
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

/** A fresh venue from the onboarding answers: sensible defaults, nothing broken. */
export function initialVenueConfig(input: z.output<typeof createVenueRequest>, newId: (prefix: string) => string): VenueConfig {
  const menus: VenueConfig["menus"] = input.menuUrl
    ? [{ id: newId("menu"), name: "Menu", externalUrl: input.menuUrl, linkLabelToken: "view_menu", sections: [] }]
    : [{ id: newId("menu"), name: "Menu", sections: [] }];
  return {
    name: input.name,
    venueType: input.venueType,
    currencyCode: input.currencyCode,
    wifi: input.wifi?.ssid ? input.wifi : null,
    socialLinks: { google: input.googleReviewUrl ?? null },
    menus,
    loyaltyProgram: input.loyalty ? { rewardName: input.loyalty.rewardName, stampsRequired: input.loyalty.stampsRequired } : null,
    branding: {
      backgroundColorHex: input.backgroundColorHex ?? "#FFFFFF",
      palette: input.palette ?? null,
      tagline: input.tagline ?? null,
      showGoogleReviewButton: !!input.googleReviewUrl,
      sudokuEnabled: true,
    },
    externalLinks: [],
    crm: { enabled: false, wifiCapture: false, feedbackCapture: false, birthdayAsk: false },
  };
}
