import "server-only";
import { createHash } from "node:crypto";
import type { Db } from "./db";
import type { PublicVenue } from "@/lib/venue/types";

/**
 * Demo venues, one per major configuration, so every flow on the landing
 * page can be exercised locally:
 *   /s?i=demo          stamp card with tiers, menu, Wi-Fi, CRM off (plain Wi-Fi)
 *   /s?i=demo-crm      Bento, White & Honey, Indian menu (₹, veg marks), Wi-Fi email gate, consent, birthday
 *   /s?i=demo-rewards  rewards-only membership, external menu, custom links, no cover
 *
 * The Google review links use the reserved `.invalid` TLD, which the page
 * treats as a placeholder and answers with an explanatory dialog.
 */
export const DEMO_VENUES: PublicVenue[] = [
  {
    id: "ven_juniper",
    shortCode: "demo",
    name: "Juniper Coffee House",
    venueType: "cafe",
    currencyCode: "GBP",
    wifi: { ssid: "Juniper-Guest", password: "flatwhite2024", security: "WPA2" },
    socialLinks: {
      google: "https://reviews.demo.invalid/juniper",
      instagram: "https://www.instagram.com/",
      facebook: "https://www.facebook.com/",
    },
    menus: [
      {
        id: "menu_juniper_all_day",
        name: "All Day",
        welcomeText: "Welcome to Juniper Coffee House",
        primaryColorHex: "#2F4A3A",
        sections: [
          {
            id: "sec_brunch",
            name: "Brunch & Small Plates",
            description: "Served all day. Ask about our gluten-free bread.",
            sortOrder: 0,
            items: [
              { id: "itm_avo", name: "Avocado on Sourdough", description: "Smashed avocado, cherry tomatoes, chilli, lime and toasted seeds", priceInPence: 1095, isAvailable: true, allergens: ["gluten"], dietaryTags: ["vegan"], calories: 410, imageUrl: "/demo/dish-avocado-toast.svg", badges: ["popular"] },
              {
                id: "itm_eggs",
                name: "Eggs Florentine",
                description: "Poached eggs, wilted spinach and hollandaise on a toasted English muffin",
                priceInPence: 1250,
                isAvailable: true,
                allergens: ["gluten", "eggs", "milk"],
                dietaryTags: ["vegetarian"],
                calories: 540,
                imageUrl: "/demo/dish-eggs-florentine.svg",
                badges: ["chef"],
                explainer: "Florentine means made with spinach. Think eggs Benedict, with spinach instead of ham.",
              },
              { id: "itm_pancakes", name: "Buttermilk Pancakes", description: "A tall stack with berries, maple syrup and whipped ricotta", priceInPence: 1050, isAvailable: true, allergens: ["gluten", "eggs", "milk"], dietaryTags: ["vegetarian"], calories: 620, imageUrl: "/demo/dish-pancakes.svg", badges: ["new"], featured: true },
              {
                id: "itm_shak",
                name: "Shakshuka",
                description: "Spiced tomato and pepper sauce, baked eggs, feta, flatbread",
                priceInPence: 1195,
                isAvailable: false,
                allergens: ["gluten", "eggs", "milk"],
                dietaryTags: ["vegetarian"],
                calories: 480,
                badges: ["spicy"],
                explainer: "A North African and Middle Eastern dish: eggs gently poached in a spiced tomato and pepper sauce, eaten with bread.",
              },
            ],
          },
          {
            id: "sec_drinks",
            name: "Coffee & Drinks",
            description: "Oat, soy or coconut milk at no extra cost.",
            sortOrder: 1,
            items: [
              { id: "itm_flat", name: "Flat White", description: "Double ristretto, silky steamed milk", priceInPence: 360, isAvailable: true, allergens: ["milk"], dietaryTags: ["vegetarian"], calories: 110, imageUrl: "/demo/dish-flat-white.svg", badges: ["popular"] },
              { id: "itm_oat", name: "Oat Latte", description: "House espresso with barista oat milk", priceInPence: 395, isAvailable: true, allergens: [], dietaryTags: ["vegan"], calories: 140 },
              {
                id: "itm_chai",
                name: "Dirty Chai",
                description: "Spiced chai latte with a shot of espresso",
                priceInPence: 420,
                isAvailable: true,
                allergens: ["milk"],
                dietaryTags: ["vegetarian"],
                calories: 190,
                badges: ["spicy"],
                explainer: "A chai latte (black tea with cinnamon, cardamom, ginger and milk) made “dirty” with a shot of espresso.",
              },
            ],
          },
        ],
      },
    ],
    loyaltyProgram: {
      rewardName: "Free Brunch",
      stampsRequired: 10,
      rewardTiers: [
        { rewardName: "Free Coffee", stampsRequired: 6 },
        { rewardName: "Free Brunch", stampsRequired: 10 },
      ],
    },
    branding: {
      coverImageUrl: "/demo/juniper-cover.svg",
      logoUrl: "/demo/juniper-logo.svg",
      titleOverride: "Juniper Coffee House",
      tagline: "Slow coffee, good company",
      backgroundColorHex: "#FFFFFF",
      showGoogleReviewButton: true,
      sudokuEnabled: true,
      featureOrder: ["loyalty", "googleReview", "menu", "wifi", "feedback"],
    },
    externalLinks: [],
    crm: { enabled: false, wifiCapture: false, feedbackCapture: false, birthdayAsk: false },
  },
  {
    // Was "The Copper Kettle"; same id and code so existing links keep working.
    id: "ven_kettle",
    shortCode: "demo-crm",
    name: "Honeycomb Café",
    venueType: "cafe",
    currencyCode: "INR",
    wifi: { ssid: "Honeycomb-Guest", password: "honeybee123", security: "WPA2" },
    socialLinks: {
      google: "https://reviews.demo.invalid/honeycomb",
      instagram: "https://www.instagram.com/",
    },
    menus: [
      {
        id: "menu_honeycomb",
        name: "Menu",
        welcomeText: "Kitchen open 8am – 10pm",
        sections: [
          {
            id: "sec_brunch_hc",
            name: "All-day brunch",
            sortOrder: 0,
            items: [
              { id: "itm_hc_pancakes", name: "Honey butter pancakes", description: "Three fluffy pancakes, wildflower honey, whipped butter and berries", priceInPence: 32000, isAvailable: true, allergens: [], dietaryTags: [], foodType: "veg", calories: 610, imageUrl: "/demo/dish-pancakes.svg", badges: ["popular"], featured: true },
              { id: "itm_hc_avo", name: "Avocado toast", description: "Smashed avocado, chilli flakes, lime and seeds on sourdough", priceInPence: 38000, isAvailable: true, allergens: [], dietaryTags: [], foodType: "veg", calories: 420, imageUrl: "/demo/dish-avocado-toast.svg" },
              { id: "itm_hc_omelette", name: "Masala omelette toast", description: "Fluffy omelette with onion, tomato, green chilli and coriander", priceInPence: 24000, isAvailable: true, allergens: [], dietaryTags: [], foodType: "egg", calories: 380, imageUrl: "/demo/dish-eggs-florentine.svg", badges: ["spicy"] },
              { id: "itm_hc_paneer", name: "Paneer tikka sandwich", description: "Tandoori paneer, mint chutney and pickled onions, toasted", priceInPence: 29000, isAvailable: true, allergens: [], dietaryTags: [], foodType: "veg", calories: 520, badges: ["chef"] },
              { id: "itm_hc_club", name: "Chicken club sandwich", description: "Grilled chicken, egg, lettuce and tomato with fries", priceInPence: 34000, isAvailable: false, allergens: [], dietaryTags: [], foodType: "nonveg", calories: 690 },
            ],
          },
          {
            id: "sec_coffee_hc",
            name: "Coffee & chai",
            sortOrder: 1,
            items: [
              { id: "itm_hc_filter", name: "Filter coffee", description: "South Indian decoction, frothed with hot milk", priceInPence: 12000, isAvailable: true, allergens: [], dietaryTags: [], foodType: "veg", calories: 120, imageUrl: "/demo/dish-flat-white.svg", badges: ["popular"] },
              { id: "itm_hc_honeycap", name: "Honey cappuccino", description: "Double shot, steamed milk and a spoon of raw honey", priceInPence: 21000, isAvailable: true, allergens: [], dietaryTags: [], foodType: "veg", calories: 160, badges: ["new"] },
              { id: "itm_hc_chai", name: "Masala chai", description: "Assam tea brewed with ginger, cardamom and cinnamon", priceInPence: 9000, isAvailable: true, allergens: [], dietaryTags: [], foodType: "veg", calories: 110 },
              { id: "itm_hc_cold", name: "Cold coffee", description: "Blended with ice cream and a drizzle of honey", priceInPence: 22000, isAvailable: true, allergens: [], dietaryTags: [], foodType: "veg", calories: 290 },
            ],
          },
        ],
      },
    ],
    loyaltyProgram: { rewardName: "Free filter coffee", stampsRequired: 8 },
    branding: {
      coverImageUrl: "/demo/honeycomb-cover.svg",
      logoUrl: "/demo/honeycomb-logo.svg",
      tagline: "Coffee, brunch & honey cake",
      layout: "grid",
      palette: "white-honey",
      backgroundColorHex: "#FFFFFF",
      showGoogleReviewButton: true,
      sudokuEnabled: true,
    },
    externalLinks: [],
    crm: { enabled: true, wifiCapture: true, feedbackCapture: true, birthdayAsk: true },
  },
  {
    id: "ven_bloom",
    shortCode: "demo-rewards",
    name: "Bloom Bakery",
    venueType: "bakery",
    currencyCode: "GBP",
    wifi: { ssid: "Bloom Free WiFi", password: null, security: "open" },
    socialLinks: { instagram: "https://www.instagram.com/" },
    menus: [
      {
        id: "menu_bloom",
        name: "Order",
        externalUrl: "https://example.com/bloom-bakery/order",
        linkLabelToken: "order_online",
        sections: [],
      },
    ],
    loyaltyProgram: { rewardName: "", stampsRequired: 0, stampsEnabled: false },
    branding: {
      logoUrl: "/demo/bloom-logo.svg",
      tagline: "Sourdough, pastries & flowers",
      backgroundColorHex: "#F6E7D8",
      style: "modern",
      showGoogleReviewButton: false,
      sudokuEnabled: true,
    },
    externalLinks: [
      { id: "lnk_book", url: "https://example.com/bloom-bakery/cake-orders", labelCustom: "Order a celebration cake", icon: "gift" },
      { id: "lnk_jobs", url: "https://example.com/bloom-bakery/jobs", labelToken: "visit_website", icon: "jobs" },
    ],
    crm: { enabled: true, wifiCapture: true, feedbackCapture: true, birthdayAsk: false },
  },
];

/** The demos' ids: they're for trying the product, so the admin console and its numbers leave them out. */
export const DEMO_VENUE_IDS = DEMO_VENUES.map((venue) => venue.id);

/** A demo venue by id or code, straight from this file (its pages need no database). */
export function demoVenue(idOrCode: string): PublicVenue | null {
  return DEMO_VENUES.find((venue) => venue.id === idOrCode || venue.shortCode === idOrCode) ?? null;
}

/** Changes whenever the demo content in this file does. */
export const DEMO_SEED_VERSION = createHash("sha256").update(JSON.stringify(DEMO_VENUES)).digest("base64url").slice(0, 16);

export async function seedDemoVenues(db: Db) {
  // Demo venues have no owner, so they're refreshed from this file whenever it
  // changes: new demo content shows up without resetting the database. Once
  // per version, not on every start (serverless hosts start often).
  const fresh = await db.run("INSERT INTO job_runs (job, key) VALUES ('demo-seed', ?) ON CONFLICT DO NOTHING", DEMO_SEED_VERSION);
  if (fresh.changes === 0) return;
  for (const venue of DEMO_VENUES) {
    const { id, shortCode, ...config } = venue;
    await db.run("INSERT INTO venues (id, short_code, config) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET config = excluded.config", id, shortCode, JSON.stringify(config));
    // Demos show every feature, so they sit on the paid plan with no owner.
    await db.run("INSERT INTO subscriptions (venue_id, plan, status) VALUES (?, 'pro', 'active') ON CONFLICT (venue_id) DO NOTHING", id);
  }
}
