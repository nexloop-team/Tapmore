import {
  BedDouble,
  Cake,
  ClipboardList,
  Coffee,
  Dumbbell,
  Pill,
  Scissors,
  ShoppingBag,
  ShoppingBasket,
  Sofa,
  Stethoscope,
  Store,
  UtensilsCrossed,
  Wine,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { CatalogueIcon, VenueType } from "@/lib/venue/business";

/** The icon for a business's catalogue (menu, products, services): sidebar, guest tile, help. */
export const CATALOGUE_ICONS: Record<CatalogueIcon, LucideIcon> = {
  food: UtensilsCrossed,
  shop: ShoppingBag,
  showroom: Sofa,
  pharmacy: Pill,
  salon: Scissors,
  clinic: Stethoscope,
  gym: Dumbbell,
  list: ClipboardList,
};

/** One recognisable icon per kind of business, for the type pickers. */
export const BUSINESS_TYPE_ICONS: Record<VenueType, LucideIcon> = {
  cafe: Coffee,
  restaurant: UtensilsCrossed,
  bakery: Cake,
  pub: Wine,
  bar: Wine,
  hotel: BedDouble,
  shop: ShoppingBasket,
  showroom: Sofa,
  pharmacy: Pill,
  salon: Scissors,
  clinic: Stethoscope,
  gym: Dumbbell,
  services: Wrench,
  other: Store,
};
