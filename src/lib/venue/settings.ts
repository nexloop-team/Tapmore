import { z } from "zod";

/**
 * Owner-only venue settings, stored in `venues.settings`. Unlike the venue
 * config these never reach the guest page.
 */

export const venueSettingsSchema = z.object({
  stampPolicy: z.object({
    /** Minimum minutes between stamp visits for one card; staff can override. */
    cooldownMinutes: z.number().int().min(0).max(24 * 60),
    /** One free stamp for a member's first feedback, once per member. */
    feedbackStamp: z.boolean(),
  }),
  automations: z.object({
    /** The birthday reward (what members get, in the owner's words) and its birthday-wish email. */
    birthday: z.object({ enabled: z.boolean(), offer: z.string().trim().max(200) }),
  }),
  /** Google review replies (once the venue has connected its Google Business Profile). */
  reviews: z.object({
    /** 4-5 star reviews get an AI reply posted straight away; off: they wait for approval. */
    autoReply: z.boolean(),
    /** The same for 1-3 star reviews; off (the default): they wait for approval with a reply drafted. */
    autoReplyCritical: z.boolean(),
    /** Optional last line of every reply, e.g. "Team Juniper". */
    signOff: z.string().trim().max(60),
  }),
});

export type VenueSettings = z.output<typeof venueSettingsSchema>;

export const DEFAULT_SETTINGS: VenueSettings = {
  stampPolicy: { cooldownMinutes: 30, feedbackStamp: true },
  automations: {
    birthday: { enabled: false, offer: "" },
  },
  reviews: { autoReply: true, autoReplyCritical: false, signOff: "" },
};

/** Saved settings over the defaults, section by section, so new fields get sensible values. */
export function resolveSettings(raw: unknown): VenueSettings {
  const saved = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof VenueSettings, Record<string, unknown>>>;
  const merged = {
    stampPolicy: { ...DEFAULT_SETTINGS.stampPolicy, ...saved.stampPolicy },
    automations: {
      birthday: { ...DEFAULT_SETTINGS.automations.birthday, ...(saved.automations?.birthday as object | undefined) },
    },
    reviews: { ...DEFAULT_SETTINGS.reviews, ...saved.reviews },
  };
  const result = venueSettingsSchema.safeParse(merged);
  return result.success ? result.data : DEFAULT_SETTINGS;
}

/** A patch names whole sections, and within a section only the fields it changes. */
export const venueSettingsPatch = z.object({
  stampPolicy: venueSettingsSchema.shape.stampPolicy.partial().optional(),
  automations: venueSettingsSchema.shape.automations.partial().optional(),
  reviews: venueSettingsSchema.shape.reviews.partial().optional(),
});

/** The saved settings with a patch applied field by field inside each section. */
export function applySettingsPatch(current: VenueSettings, patch: z.output<typeof venueSettingsPatch>): unknown {
  return {
    stampPolicy: { ...current.stampPolicy, ...stripUndefined(patch.stampPolicy) },
    automations: { ...current.automations, ...stripUndefined(patch.automations) },
    reviews: { ...current.reviews, ...stripUndefined(patch.reviews) },
  };
}

function stripUndefined<T extends object>(value: T | undefined): Partial<T> {
  return Object.fromEntries(Object.entries(value ?? {}).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export type VenueSettingsPatch = z.input<typeof venueSettingsPatch>;
