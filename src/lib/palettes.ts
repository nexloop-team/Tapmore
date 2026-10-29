/**
 * Colour palettes for the guest page. One pick sets everything: the page
 * background, and for the bento layout its three tile shades.
 *
 * Each is one family of colours in clear steps, light to deep: a tinted
 * page, near-white cards on it, a mid tone for the accent tile and a deep
 * tone for the anchor tiles (text in that deep tone on the light tiles).
 * A palette that's been retired (Coffee House, Matcha, Rose Clay) is no
 * longer found: a page that saved one keeps its page colour, and its tile
 * shades are worked out from that colour instead.
 */

export interface Palette {
  id: string;
  name: string;
  /** Page background. */
  bg: string;
  /** Deep tile: loyalty card, Google review. */
  hero: string;
  /** Accent: Wi-Fi tile, stamp bars, pills, stars. */
  pop: string;
  /** Soft tile: menu, feedback, Sudoku, links. */
  pale: string;
}

export const PALETTES: Palette[] = [
  { id: "stone", name: "Stone", bg: "#E8E4DD", hero: "#2E2B28", pop: "#CBC3B6", pale: "#FFFDFA" },
  // A white page: soft grey tiles, ink for the stamp card and reviews, honey for Wi-Fi.
  { id: "white-honey", name: "White & Honey", bg: "#FFFFFF", hero: "#1C1C1E", pop: "#E6B85C", pale: "#F3F2EE" },
];

export function findPalette(id: string | null | undefined): Palette | null {
  return PALETTES.find((palette) => palette.id === id) ?? null;
}
