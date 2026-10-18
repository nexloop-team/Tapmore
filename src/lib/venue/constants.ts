/**
 * The fixed option lists behind a venue's settings. Kept apart from
 * ./schema (zod) so the guest pages and editors can use them without
 * shipping the validator to the browser.
 */

export const ALLERGENS = [
  "celery", "gluten", "crustaceans", "eggs", "fish", "lupin", "milk", "molluscs", "mustard", "nuts", "peanuts", "sesame", "soya", "sulphites",
] as const;
export const DIETARY_TAGS = ["vegan", "vegetarian", "gluten_free"] as const;
export const MENU_BADGES = ["popular", "new", "spicy", "chef"] as const;
/** The Indian veg / non-veg mark (see lib/venue/region). */
export const FOOD_TYPES = ["veg", "nonveg", "egg"] as const;
export const VENUE_TYPES = ["cafe", "restaurant", "bakery", "pub", "bar", "hotel", "other"] as const;
export const CURRENCIES = ["INR", "GBP", "EUR", "USD", "AUD", "CAD", "NZD", "AED", "SGD", "ZAR"] as const;
export const LINK_LABEL_TOKENS = ["view_menu", "view_price_list", "our_services", "book_now", "visit_website", "order_online"] as const;
