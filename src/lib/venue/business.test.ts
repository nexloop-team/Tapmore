import { describe, expect, it } from "vitest";
import { DEMO_VENUES } from "@/server/seed";
import { BUSINESS_GROUPS, businessProfile, RETIRED_TYPES } from "./business";
import { VENUE_TYPES } from "./constants";
import { createVenueRequest, initialVenueConfig, menuItemSchema, venueConfigSchema } from "./schema";

function newVenue(input: Record<string, unknown>) {
  let n = 0;
  const parsed = createVenueRequest.parse({ name: "Test", currencyCode: "INR", ...input });
  return initialVenueConfig(parsed, (prefix) => `${prefix}_${++n}`);
}

describe("items typed in during setup", () => {
  it("become one section named after the catalogue, valid as saved config", () => {
    const config = newVenue({
      venueType: "salon",
      items: [
        { name: "Haircut", priceInPence: 49900 },
        { name: "Bridal makeup", priceInPence: 0, priceMode: "on_request" },
      ],
    });
    const [section] = config.menus[0].sections;
    expect(section.name).toBe("Services");
    expect(section.items.map((item) => [item.name, item.priceInPence, item.priceMode ?? "exact"])).toEqual([
      ["Haircut", 49900, "exact"],
      ["Bridal makeup", 0, "on_request"],
    ]);
    expect(venueConfigSchema.safeParse(config).success).toBe(true);
  });

  it("are grouped into one section per category, in the order first used", () => {
    const config = newVenue({
      venueType: "showroom",
      items: [
        { name: "Teak sofa", priceInPence: 4500000, category: "Sofas" },
        { name: "Oak bed", priceInPence: 3200000, category: "Beds" },
        { name: "Recliner", priceInPence: 2800000, category: " sofas " },
        { name: "Cushion", priceInPence: 49900 },
      ],
    });
    expect(config.menus[0].sections.map((section) => [section.name, section.sortOrder, section.items.map((item) => item.name)])).toEqual([
      ["Sofas", 0, ["Teak sofa", "Recliner"]],
      ["Beds", 1, ["Oak bed"]],
      ["Products", 2, ["Cushion"]],
    ]);
    expect(venueConfigSchema.safeParse(config).success).toBe(true);
  });

  it("keep the café details for food (veg mark, description, allergens) and drop them for other businesses", () => {
    const dish = { name: "Paneer tikka", priceInPence: 24000, category: "Starters", foodType: "veg", description: "Smoky cottage cheese", allergens: ["milk"] };
    const [cafeItem] = newVenue({ venueType: "cafe", items: [dish] }).menus[0].sections[0].items;
    expect(cafeItem).toMatchObject({ foodType: "veg", description: "Smoky cottage cheese", allergens: ["milk"] });
    const [shopItem] = newVenue({ venueType: "shop", items: [dish] }).menus[0].sections[0].items;
    expect(shopItem.foodType).toBeUndefined();
    expect(shopItem.description).toBeUndefined();
    expect(shopItem.allergens).toEqual([]);
  });

  it("leave the menu empty without items, and accept at most 300", () => {
    expect(newVenue({ venueType: "shop" }).menus[0].sections).toEqual([]);
    const many = Array.from({ length: 301 }, (_, i) => ({ name: `Item ${i}`, priceInPence: 100 }));
    expect(createVenueRequest.safeParse({ name: "Test", currencyCode: "INR", items: many }).success).toBe(false);
  });
});

describe("business profiles", () => {
  it("offer every current type once in the pickers, each with a 'who it's for' line; retired types stay valid", () => {
    const grouped = BUSINESS_GROUPS.flatMap((group) => group.types);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped, ...RETIRED_TYPES].sort()).toEqual([...VENUE_TYPES].sort());
    for (const type of grouped) expect(businessProfile(type).hint).toBeTruthy();
    for (const type of VENUE_TYPES) {
      const profile = businessProfile(type);
      expect(profile.type).toBe(type);
      expect(profile.label && profile.catalogue && profile.item && profile.items && profile.people && profile.spot).toBeTruthy();
    }
  });

  it("treat venues saved before the type was asked as cafés, and unknown types as 'other'", () => {
    expect(businessProfile(null).type).toBe("cafe");
    expect(businessProfile("spaceship").type).toBe("other");
  });

  it("keep food fields and tables for food only", () => {
    expect(businessProfile("restaurant")).toMatchObject({ foodFields: true, catalogue: "Menu", spot: "Table", people: "guests" });
    expect(businessProfile("shop")).toMatchObject({ foodFields: false, catalogue: "Products", spot: "Counter", people: "customers" });
    expect(businessProfile("salon")).toMatchObject({ foodFields: false, catalogue: "Services", booking: true });
  });

  it("suggest no stamp card or reward where rewards are restricted or purchases are rare", () => {
    expect(businessProfile("clinic")).toMatchObject({ stampCard: false, defaultReward: "", professionalRules: true, people: "patients" });
    expect(businessProfile("pharmacy")).toMatchObject({ stampCard: false, defaultReward: "", professionalRules: true });
    expect(businessProfile("showroom")).toMatchObject({ stampCard: false, professionalRules: false });
    expect(businessProfile("cafe").stampCard).toBe(true);
  });
});

describe("a new business", () => {
  it("shop: a 'Products' list with a price-list label, no Sudoku, a spend rule kept", () => {
    const config = newVenue({ venueType: "shop", loyalty: { rewardName: "10% off your next bill", stampsRequired: 8, stampRule: "1 stamp for every ₹500 spent" } });
    expect(venueConfigSchema.safeParse(config).success).toBe(true);
    expect(config.menus[0]).toMatchObject({ name: "Products", linkLabelToken: "view_price_list" });
    expect(config.branding.sudokuEnabled).toBe(false);
    expect(config.loyaltyProgram?.stampRule).toBe("1 stamp for every ₹500 spent");
  });

  it("salon: 'Services', Sudoku on for the waiting room, and its booking link as a 'Book now' card", () => {
    const config = newVenue({ venueType: "salon", bookingUrl: "https://wa.me/919800000000" });
    expect(config.menus[0]).toMatchObject({ name: "Services", linkLabelToken: "our_services" });
    expect(config.branding.sudokuEnabled).toBe(true);
    expect(config.externalLinks).toEqual([{ id: expect.any(String), url: "https://wa.me/919800000000", labelToken: "book_now", icon: "calendar" }]);
  });

  it("café: unchanged ('Menu', no label override, Sudoku on, no booking card)", () => {
    const config = newVenue({ venueType: "cafe", loyalty: { rewardName: "Free coffee", stampsRequired: 9 } });
    expect(config.menus[0].name).toBe("Menu");
    expect(config.menus[0].linkLabelToken).toBeUndefined();
    expect(config.branding.sudokuEnabled).toBe(true);
    expect(config.externalLinks).toEqual([]);
    expect(config.loyaltyProgram).toEqual({ rewardName: "Free coffee", stampsRequired: 9 });
  });
});

describe("prices", () => {
  const item = { id: "itm_1", name: "Sofa", isAvailable: true, allergens: [], dietaryTags: [] };

  it("allow showroom prices up to ₹10 crore", () => {
    expect(menuItemSchema.safeParse({ ...item, priceInPence: 2_50_000_00 }).success).toBe(true);
    expect(menuItemSchema.safeParse({ ...item, priceInPence: 1_000_000_000 }).success).toBe(true);
    expect(menuItemSchema.safeParse({ ...item, priceInPence: 1_000_000_001 }).success).toBe(false);
  });

  it("can be a 'From' price or on request", () => {
    expect(menuItemSchema.parse({ ...item, priceInPence: 49900, priceMode: "from" }).priceMode).toBe("from");
    expect(menuItemSchema.parse({ ...item, priceInPence: 0, priceMode: "on_request" }).priceMode).toBe("on_request");
    expect(menuItemSchema.safeParse({ ...item, priceInPence: 0, priceMode: "negotiable" }).success).toBe(false);
  });
});

describe("demos", () => {
  it("include a salon and a shop, all valid", () => {
    expect(DEMO_VENUES.map((venue) => venue.venueType)).toEqual(expect.arrayContaining(["salon", "shop"]));
    for (const { id: _id, shortCode: _code, ...config } of DEMO_VENUES) {
      void _id;
      void _code;
      const result = venueConfigSchema.safeParse(config);
      expect(result.success, `${config.name}: ${result.error?.issues[0]?.message}`).toBe(true);
    }
  });
});

describe("setup extras", () => {
  it("keep the phone, Instagram, layout and refer-a-friend chosen in setup", () => {
    const config = newVenue({
      venueType: "salon",
      phone: "+91 98765 43210",
      instagram: "https://www.instagram.com/glowsalon",
      layout: "grid",
      loyalty: { rewardName: "Free haircut", stampsRequired: 6, referral: true },
    });
    expect(venueConfigSchema.safeParse(config).success).toBe(true);
    expect(config.phone).toBe("+91 98765 43210");
    expect(config.socialLinks.instagram).toBe("https://www.instagram.com/glowsalon");
    expect(config.branding.layout).toBe("grid");
    expect(config.loyaltyProgram?.referral).toEqual({ enabled: true, referrerStamps: 2, friendStamps: 1 });
  });

  it("refuse things that aren't phone numbers, and more than 5 banners", () => {
    expect(() => newVenue({ venueType: "shop", phone: "call me" })).toThrow();
    const banner = "/media/ven_x/img_1.webp";
    const base = newVenue({ venueType: "shop" });
    expect(venueConfigSchema.safeParse({ ...base, branding: { ...base.branding, coverImageUrls: Array(5).fill(banner) } }).success).toBe(true);
    expect(venueConfigSchema.safeParse({ ...base, branding: { ...base.branding, coverImageUrls: Array(6).fill(banner) } }).success).toBe(false);
  });
});

describe("saved pages", () => {
  it("never keep a browser-only blob: photo", () => {
    const base = newVenue({ venueType: "shop" });
    expect(venueConfigSchema.safeParse({ ...base, branding: { ...base.branding, logoUrl: "blob:https://x/1" } }).success).toBe(false);
    expect(venueConfigSchema.safeParse({ ...base, branding: { ...base.branding, coverImageUrls: ["blob:https://x/1"] } }).success).toBe(false);
  });
});
