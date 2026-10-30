import { VENUE_TYPES } from "./constants";

/**
 * What kind of business a venue is, and the words and defaults that follow
 * from it. Tapmore started with cafés; a shop, showroom, salon or clinic gets
 * the same product with its own words ("Products", "Counter 1",
 * "customers") and without the food-only parts of the menu (veg marks,
 * allergens, calories, "What's this?"). Only wording and defaults change:
 * the data, routes and code names stay venue / menu / table throughout.
 */

export type VenueType = (typeof VENUE_TYPES)[number];
export type BusinessGroup = "food" | "retail" | "service";
/** Which icon stands for the catalogue (mapped to an icon component in the UI). */
export type CatalogueIcon = "food" | "shop" | "showroom" | "pharmacy" | "salon" | "clinic" | "gym" | "list";

export interface BusinessProfile {
  type: VenueType;
  group: BusinessGroup;
  /** For pickers: "Café", "Salon & spa". */
  label: string;
  /** Under the label in pickers, so an owner knows which to choose: "Kirana, clothing, mobiles, gifts". */
  hint: string;
  /** In a sentence: "a café", "your salon". */
  noun: string;
  /** The menu's name in the nav, editor and guest page: "Menu", "Products", "Services". */
  catalogue: string;
  /** One entry in it, and several: "dish" / "dishes", "product" / "products". */
  item: string;
  items: string;
  /** The people the business serves, in the owner's words: "guests", "customers", "patients". */
  people: string;
  /** Where a QR code stands, numbered on print: "Table 4", "Counter 2". */
  spot: string;
  /** Veg marks, allergens, dietary tags, calories, spicy / chef's special, "What's this?". */
  foodFields: boolean;
  /** Onboarding asks for the Wi-Fi up front (otherwise it's one tap away). */
  wifi: boolean;
  /** New venues start with Sudoku on (something to do while waiting). */
  sudoku: boolean;
  /** Onboarding starts with the stamp card on. Off where purchases are rare or rewards are restricted. */
  stampCard: boolean;
  /** The suggested reward; empty where none should be suggested (clinics). */
  defaultReward: string;
  /** How a stamp is earned, shown on the card and the till; empty keeps today's behaviour (no rule shown). */
  stampRule: string;
  /** Onboarding asks for a booking link (appointment businesses). */
  booking: boolean;
  /** Doctors and pharmacies have rules on rewards and on what can be said publicly about patients. */
  professionalRules: boolean;
  icon: CatalogueIcon;
  /** The guest page's catalogue-card label token (see LINK_LABEL_TOKENS). */
  linkToken: "view_menu" | "view_price_list" | "our_services";
  namePlaceholder: string;
  sectionPlaceholder: string;
  itemPlaceholder: string;
}

type Profile = Omit<BusinessProfile, "type">;
type Base = Omit<Profile, "label" | "hint" | "noun" | "defaultReward" | "namePlaceholder">;

const FOOD: Base = {
  group: "food",
  catalogue: "Menu",
  item: "dish",
  items: "dishes",
  people: "guests",
  spot: "Table",
  foodFields: true,
  wifi: true,
  sudoku: true,
  stampCard: true,
  stampRule: "",
  booking: false,
  professionalRules: false,
  icon: "food",
  linkToken: "view_menu",
  sectionPlaceholder: "Starters or Coffee",
  itemPlaceholder: "Masala dosa",
};

const RETAIL: Base = {
  group: "retail",
  catalogue: "Products",
  item: "product",
  items: "products",
  people: "customers",
  spot: "Counter",
  foodFields: false,
  wifi: false,
  sudoku: false,
  stampCard: true,
  stampRule: "1 stamp for every ₹500 spent",
  booking: false,
  professionalRules: false,
  icon: "shop",
  linkToken: "view_price_list",
  sectionPlaceholder: "Groceries or New arrivals",
  itemPlaceholder: "Basmati rice, 5 kg",
};

const SERVICE: Base = {
  group: "service",
  catalogue: "Services",
  item: "service",
  items: "services",
  people: "customers",
  spot: "Counter",
  foodFields: false,
  wifi: true,
  sudoku: true,
  stampCard: true,
  stampRule: "1 stamp per visit",
  booking: true,
  professionalRules: false,
  icon: "list",
  linkToken: "our_services",
  sectionPlaceholder: "Hair or Packages",
  itemPlaceholder: "Haircut and wash",
};

const PROFILES: Record<VenueType, Profile> = {
  cafe: { ...FOOD, label: "Café & bakery", hint: "Coffee, tea, cakes, sweets, desserts", noun: "café", defaultReward: "Free coffee", namePlaceholder: "Juniper Coffee House" },
  restaurant: { ...FOOD, label: "Restaurant", hint: "Dine-in, dhaba, family restaurant", noun: "restaurant", defaultReward: "Free dessert", namePlaceholder: "Spice Route Kitchen" },
  // Not offered in the picker any more ("Café & bakery" covers it); kept for venues that chose it.
  bakery: {
    ...FOOD,
    label: "Bakery & sweets",
    hint: "Cakes, bread, mithai",
    noun: "bakery",
    defaultReward: "Free pastry",
    namePlaceholder: "Bloom Bakery",
    sectionPlaceholder: "Breads or Cakes",
  },
  // Not offered in the picker any more ("Bar & pub" covers it); kept for venues that chose it.
  pub: { ...FOOD, label: "Pub", hint: "Drinks and bar food", noun: "pub", defaultReward: "Free drink", namePlaceholder: "The Red Lion", sectionPlaceholder: "Beers or Bar snacks" },
  bar: {
    ...FOOD,
    label: "Bar & pub",
    hint: "Drinks and bar food",
    noun: "bar",
    defaultReward: "Free drink",
    namePlaceholder: "Copper Bar",
    sectionPlaceholder: "Cocktails or Small plates",
  },
  hotel: {
    ...FOOD,
    label: "Hotel & stay",
    hint: "Hotels, resorts, homestays",
    noun: "hotel",
    defaultReward: "Free breakfast",
    namePlaceholder: "Lakeview Hotel",
    sectionPlaceholder: "Breakfast or Room service",
  },
  shop: { ...RETAIL, label: "Shop", hint: "Kirana, clothing, mobiles, medical, gifts", noun: "shop", defaultReward: "10% off your next bill", namePlaceholder: "Sharma General Store" },
  // Rare, high-value purchases: a visit stamp card rarely fits; reviews and word of mouth matter more.
  showroom: {
    ...RETAIL,
    label: "Showroom",
    hint: "Furniture, electronics, vehicles, jewellery",
    noun: "showroom",
    icon: "showroom",
    stampCard: false,
    stampRule: "1 stamp per purchase",
    defaultReward: "₹1,000 off your next purchase",
    namePlaceholder: "Royal Furniture Gallery",
    sectionPlaceholder: "Sofas or New arrivals",
    itemPlaceholder: "3-seater fabric sofa",
  },
  // Not offered in the picker; kept for venues that chose it. Prescription medicines can't be
  // promoted or discounted as an inducement, so it suggests no reward.
  pharmacy: {
    ...RETAIL,
    label: "Pharmacy",
    hint: "Chemist, wellness, surgicals",
    noun: "pharmacy",
    icon: "pharmacy",
    stampCard: false,
    professionalRules: true,
    stampRule: "",
    defaultReward: "",
    namePlaceholder: "Care Pharmacy",
    sectionPlaceholder: "Wellness or Baby care",
    itemPlaceholder: "Vitamin C, 60 tablets",
  },
  salon: { ...SERVICE, label: "Salon & spa", hint: "Hair, beauty, nails, massage", noun: "salon", icon: "salon", defaultReward: "Free haircut", namePlaceholder: "Glow Salon" },
  // Doctors may not solicit patients or offer inducements (NMC rules): no stamp card or reward suggested.
  clinic: {
    ...SERVICE,
    label: "Clinic",
    hint: "Doctor, dentist, physio, lab",
    noun: "clinic",
    icon: "clinic",
    people: "patients",
    stampCard: false,
    professionalRules: true,
    stampRule: "",
    defaultReward: "",
    namePlaceholder: "City Care Clinic",
    sectionPlaceholder: "Consultations or Tests",
    itemPlaceholder: "General consultation",
  },
  gym: {
    ...SERVICE,
    label: "Gym & studio",
    hint: "Gym, yoga, dance, classes",
    noun: "gym",
    icon: "gym",
    sudoku: false,
    defaultReward: "Free personal training session",
    namePlaceholder: "Iron House Fitness",
    sectionPlaceholder: "Memberships or Classes",
    itemPlaceholder: "Monthly membership",
  },
  services: {
    ...SERVICE,
    label: "Other services",
    hint: "Repairs, laundry, tutoring, travel",
    noun: "business",
    wifi: false,
    sudoku: false,
    catalogue: "Price list",
    defaultReward: "10% off your next visit",
    namePlaceholder: "QuickFix Repairs",
    sectionPlaceholder: "Repairs or Packages",
    itemPlaceholder: "Screen replacement",
  },
  other: {
    ...SERVICE,
    // Not offered in the picker ("Other services" covers it); the fallback for unknown types.
    label: "Other",
    hint: "",
    noun: "business",
    wifi: false,
    sudoku: false,
    booking: false,
    catalogue: "Price list",
    item: "item",
    items: "items",
    stampRule: "",
    linkToken: "view_price_list",
    icon: "list",
    defaultReward: "10% off your next visit",
    namePlaceholder: "Your business name",
    sectionPlaceholder: "Popular or New",
    itemPlaceholder: "Your best seller",
  },
};

/**
 * The kinds of business the pickers offer, grouped and in order. Bakery, pub,
 * pharmacy and other aren't offered ("Café & bakery", "Bar & pub", "Shop" and
 * "Other services" cover them) but stay valid for venues that already chose them.
 */
export const BUSINESS_GROUPS: { group: BusinessGroup; label: string; types: VenueType[] }[] = [
  { group: "food", label: "Food & drink", types: ["cafe", "restaurant", "bar", "hotel"] },
  { group: "retail", label: "Shops", types: ["shop", "showroom"] },
  { group: "service", label: "Services", types: ["salon", "clinic", "gym", "services"] },
];

/** Types kept for old venues but no longer offered in the pickers. */
export const RETIRED_TYPES: VenueType[] = ["bakery", "pub", "pharmacy", "other"];

/**
 * The profile for a venue type. Venues saved before the type was asked
 * (no type) were all cafés; an unknown type is treated as "other".
 */
export function businessProfile(type: string | null | undefined): BusinessProfile {
  const key = (type ?? "cafe").trim().toLowerCase();
  const known = (VENUE_TYPES as readonly string[]).includes(key) ? (key as VenueType) : "other";
  return { type: known, ...PROFILES[known] };
}

/** "Products" → "products", for the middle of a sentence. */
export function lower(word: string): string {
  return word.charAt(0).toLowerCase() + word.slice(1);
}

/** One of the people a business serves, capitalised for a title: "guests" → "Guest", "customers" → "Customer". */
export function personWord(profile: Pick<BusinessProfile, "people">): string {
  return capitalise(profile.people).replace(/s$/, "");
}

/** "dish" → "Dish". */
export function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
