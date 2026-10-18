/**
 * The public shape of a venue as the guest pages receive it (rendered on
 * the server). Everything here is safe to show to anyone holding the QR
 * code; private merchant data never enters this type.
 */

export type LinkLabelToken =
  | "view_menu"
  | "view_price_list"
  | "our_services"
  | "book_now"
  | "visit_website"
  | "order_online";

export interface RewardTier {
  rewardName: string;
  stampsRequired: number;
}

export interface LoyaltyProgram {
  rewardName: string;
  stampsRequired: number;
  /** `false` makes this a rewards-only membership: a pass, but no stamps. */
  stampsEnabled?: boolean;
  rewardTiers?: RewardTier[];
  referral?: { enabled: boolean; referrerStamps: number; friendStamps: number };
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  priceInPence: number;
  isAvailable: boolean;
  allergens: string[];
  dietaryTags: string[];
  /** Indian menus: the veg / non-veg / egg mark. */
  foodType?: "veg" | "nonveg" | "egg" | null;
  calories?: number | null;
  imageUrl?: string | null;
  /** "What's this?" text for unfamiliar dishes. */
  explainer?: string | null;
  badges?: ("popular" | "new" | "spicy" | "chef")[];
  /** In the "Today's specials" strip. */
  featured?: boolean;
}

export interface MenuSection {
  id: string;
  name: string;
  /** A short line under the section title, e.g. "Served until 11:30". */
  description?: string | null;
  sortOrder: number;
  items: MenuItem[];
}

export interface Menu {
  id: string;
  name: string;
  /** When set, the menu card opens this URL instead of the hosted menu page. */
  externalUrl?: string | null;
  linkLabelToken?: LinkLabelToken | null;
  linkLabelCustom?: string | null;
  welcomeText?: string | null;
  primaryColorHex?: string | null;
  /** Print each item's kcal (required in some jurisdictions, optional elsewhere). */
  showCalories?: boolean | null;
  /** rows with thumbnails ("list", the default), big photo cards, or a printed-menu look. */
  layout?: MenuLayout | null;
  sections: MenuSection[];
}

export interface ExternalLink {
  id: string;
  url: string;
  labelToken?: string | null;
  labelCustom?: string | null;
  icon?: string | null;
}

export type LandingStyle = "classic" | "editorial" | "modern";

export interface VenueBranding {
  coverImageUrl?: string | null;
  logoUrl?: string | null;
  /** Whitespace-only hides the title; absent falls back to the venue name. */
  titleOverride?: string | null;
  tagline?: string | null;
  backgroundColorHex?: string | null;
  /** A named colour palette (see lib/palettes): sets the page colour and the bento tile shades together. */
  palette?: string | null;
  /** No longer used (tile colours now come from the palette or the page). Kept so older saves still load. Grid layout: the colour its tiles are shaded from. Absent means the page colour, or a deep green on white or black pages. */
  tileColorHex?: string | null;
  /** No longer used: the second colour is always a brighter shade of the tile colour. Kept so older saves still load. */
  tileAccentHex?: string | null;
  /** Bento: where the tile colours came from, for the editor. Absent: "custom" if a tile colour is set, else "page". */
  tileSource?: "logo" | "page" | "custom" | null;
  /** Forces the card chrome light or dark regardless of the page colour. */
  /** No longer used: cards are always light. Kept so older saves still load. */
  appearance?: "light" | "dark" | null;
  style?: LandingStyle | null;
  showGoogleReviewButton?: boolean;
  sudokuEnabled?: boolean;
  /** Feature keys (plus `link:<id>`) in the merchant's preferred order. */
  featureOrder?: string[];
  /** Cards the merchant has switched off (feature keys or `link:<id>`). Sudoku and the Google review card use their own switches. */
  hiddenFeatures?: string[];
  /** The merchant's own wording for a core card, e.g. "Coffee club" for loyalty. */
  featureLabels?: Partial<Record<"loyalty" | "menu" | "wifi" | "sudoku" | "feedback" | "google_review", string>>;
  /** how the cards are laid out. Absent means "list". */
  layout?: PageLayout | null;
  /** Logo beside the name ("cover", the default), centred, or no logo circle. The guest page keeps the name over the cover photo in all three. */
  headerStyle?: HeaderStyle | null;
  /** corner shape of cards and buttons. Absent means "rounded". */
  buttonShape?: ButtonShape | null;
}

export type PageLayout = "list" | "grid" | "compact";
export type HeaderStyle = "cover" | "centered" | "minimal";
export type ButtonShape = "rounded" | "pill" | "square";
/** "photo" is retired: older saves show as the list. */
export type MenuLayout = "list" | "photo" | "classic";

export interface SocialLinks {
  google?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  tripAdvisor?: string | null;
  youtube?: string | null;
}

export interface WifiDetails {
  ssid: string;
  password?: string | null;
  /** e.g. "WPA2"; "open" / "none" / "nopass" mean no password. */
  security?: string | null;
}

/** Customer-platform switches, already resolved server-side. */
export interface CrmSettings {
  enabled: boolean;
  /** The owner's option: ask for an email before showing the Wi-Fi password. No stamp is given for it. */
  wifiCapture: boolean;
  /** Offer the rewards-only join on the feedback thank-you. */
  feedbackCapture: boolean;
  /** Ask for a birthday (month and day, never a year). */
  birthdayAsk: boolean;
}

export interface PublicVenue {
  id: string;
  shortCode: string;
  name: string;
  /** "pub" and "bar" raise the consent age line from 13+ to 18+. */
  venueType?: string | null;
  currencyCode: string;
  wifi?: WifiDetails | null;
  socialLinks: SocialLinks;
  menus: Menu[];
  loyaltyProgram?: LoyaltyProgram | null;
  branding: VenueBranding;
  externalLinks: ExternalLink[];
  crm: CrmSettings;
  /** Banner under the header, e.g. today's special; `until` is the last day it shows. */
  announcement?: { text: string; until?: string | null } | null;
}
