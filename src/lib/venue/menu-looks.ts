import type { BusinessProfile } from "./business";
import type { MenuLayout } from "./types";

/** How the menu page draws its items. */
export type MenuLook = "list" | "classic" | "grid" | "simple" | "service";

/**
 * The looks the owner chooses between, by kind of business. The first is the
 * default (stored as no layout at all), so a page always gets a look made for
 * what it sells:
 * - food: rows with photos like a food app, or a classic printed menu;
 * - shops and showrooms: a photo grid like an online shop, or a compact list
 *   for a store with hundreds of items;
 * - services: a list with descriptions and "From" prices, or a printed rate card.
 */
export const MENU_LOOKS: Record<BusinessProfile["group"], { layout: MenuLayout | null; look: MenuLook; label: string }[]> = {
  food: [
    { layout: null, look: "list", label: "Cards with photos" },
    { layout: "classic", look: "classic", label: "Classic printed" },
  ],
  retail: [
    { layout: null, look: "grid", label: "Product grid" },
    { layout: "simple", look: "simple", label: "Simple list" },
  ],
  service: [
    { layout: null, look: "service", label: "Service list" },
    { layout: "classic", look: "classic", label: "Rate card" },
  ],
};

/** The look a saved layout gives this kind of business; one made for another kind falls back to the default. */
export function menuLook(layout: MenuLayout | null | undefined, group: BusinessProfile["group"]): MenuLook {
  const options = MENU_LOOKS[group];
  return (options.find((option) => option.layout === layout) ?? options[0]).look;
}
