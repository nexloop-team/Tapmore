import { findPalette, type Palette } from "./palettes";
import type { LandingStyle, VenueBranding } from "./venue/types";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let clean = hex.replace(/^#/, "");
  if (clean.length === 3) clean = clean.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const n = parseInt(clean, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isLightColor(hex: string): boolean {
  return relativeLuminance(hex) > 0.45;
}

function textVars(prefix: "text" | "card-text", isLight: boolean): Record<string, string> {
  // Secondary/tertiary are alpha of the primary, never a fixed grey, so they
  // stay legible on any brand colour.
  const rgb = isLight ? "26,26,26" : "255,255,255";
  return {
    [`--${prefix}-primary`]: isLight ? "#1A1A1A" : "#FFFFFF",
    [`--${prefix}-secondary`]: `rgba(${rgb},0.7)`,
    [`--${prefix}-tertiary`]: `rgba(${rgb},0.5)`,
    // A faint wash of the text colour: announcement and social chips sit on it.
    [`--${prefix}-tint`]: `rgba(${rgb},0.08)`,
  };
}

const LIGHT_CARDS: Record<string, string> = {
  "--card-bg": "#FFFFFF",
  "--card-elevation": "0 1px 2px rgba(0,0,0,0.05), 0 6px 20px rgba(0,0,0,0.07)",
  "--icon-soft": "14%",
  "--card-shadow": "rgba(0,0,0,0.1)",
  "--card-border": "rgba(0,0,0,0.06)",
  "--input-bg": "#F2F2F7",
  "--input-border": "#D1D1D6",
  "--separator": "rgba(60,60,67,0.12)",
  "--accent-blue": "#1447E6",
  "--sudoku-accent": "#7D59D9",
  "--sudoku-on-accent": "#FFFFFF",
  "--sudoku-sel": "rgba(125,89,217,0.30)",
  "--sudoku-same": "rgba(125,89,217,0.16)",
  "--sudoku-peer": "rgba(0,0,0,0.06)",
  "--sudoku-line": "rgba(60,60,67,0.18)",
  "--sudoku-line-strong": "rgba(60,60,67,0.55)",
};

const DARK_CARDS: Record<string, string> = {
  "--card-bg": "#262626",
  "--card-elevation": "0 1px 2px rgba(0,0,0,0.3)",
  "--icon-soft": "22%",
  "--card-shadow": "rgba(0,0,0,0.1)",
  "--card-border": "rgba(255,255,255,0.15)",
  "--input-bg": "#3A3A3C",
  "--input-border": "#48484A",
  "--separator": "rgba(84,84,88,0.34)",
  "--accent-blue": "#5B8DEF",
  "--sudoku-accent": "#B79BFF",
  "--sudoku-on-accent": "#1C1C1E",
  "--sudoku-sel": "rgba(183,155,255,0.30)",
  "--sudoku-same": "rgba(183,155,255,0.16)",
  "--sudoku-peer": "rgba(255,255,255,0.07)",
  "--sudoku-line": "rgba(235,235,245,0.20)",
  "--sudoku-line-strong": "rgba(235,235,245,0.50)",
};

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
}

/** Black-ish or white text, whichever contrasts more with the colour. */
function textOn(hex: string): string {
  const l = relativeLuminance(hex);
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.06 ? "#FFFFFF" : "#1A1A1A";
}

/** Nudge a colour's lightness until black or white text on it passes AA (4.5:1). */
function readable(hex: string, direction: "lighter" | "darker"): string {
  const { h, s, l } = rgbToHsl(hexToRgb(hex)!);
  const passes = (c: string) => {
    const lum = relativeLuminance(c);
    return Math.max(1.05 / (lum + 0.05), (lum + 0.05) / 0.06) >= 4.5;
  };
  let light = l;
  let colour = hex;
  for (let i = 0; i < 40 && !passes(colour); i++) {
    light = direction === "lighter" ? Math.min(0.95, light + 0.015) : Math.max(0.05, light - 0.015);
    colour = hslToHex(h, s, light);
  }
  return colour.toUpperCase();
}

/**
 * The bento layout's three tile shades:
 *
 * - **hero** (loyalty, Google review): a deep anchor colour;
 * - **pop** (Wi-Fi, stamp bars, pills, stars): a soft accent;
 * - **pale** (everything else): a wash just off the page colour.
 *
 * A chosen palette names all three. For the owner's own page colour they're
 * worked out in the same quiet style: a deep and a muted shade of its hue,
 * or ink and stone when the page is white, black or grey. Each shade is
 * nudged until its text passes AA.
 */
export function tilePalette(branding: VenueBranding, isLightCards: boolean): Record<string, string> {
  return paletteTiles(findPalette(branding.palette) ?? ownPalette(branding.backgroundColorHex, isLightCards));
}

/** A palette in the house style, from any page colour. */
function ownPalette(backgroundHex: string | null | undefined, isLightCards: boolean): Palette {
  const bg = hexToRgb(backgroundHex?.trim() ?? "") ? `#${backgroundHex!.trim().replace(/^#/, "").toUpperCase()}` : "#FFFFFF";
  const { h, s, l } = rgbToHsl(hexToRgb(bg)!);
  const darkPage = !isLightColor(bg);
  const neutral = s < 0.12 || l < 0.05 || l > 0.97;
  const sat = Math.min(Math.max(s, 0.25), 0.5);
  const hue = neutral ? 0 : h;
  const tint = neutral ? 0 : Math.min(s, 0.3);
  // Deep enough to anchor the page: darker than a light or mid page, a step lighter than a very dark one.
  const hero = neutral
    ? darkPage
      ? hslToHex(0, 0, Math.min(l + 0.14, 0.24))
      : "#1C1C1E"
    : darkPage && l < 0.25
      ? hslToHex(h, Math.min(s, 0.4), l + 0.12)
      : hslToHex(h, sat, darkPage ? Math.max(l - 0.22, 0.12) : 0.2);
  // Black, white and grey pages get a honey accent; a coloured page a brighter shade of its own hue.
  const pop = neutral ? "#E6B85C" : hslToHex(h, Math.min(Math.max(s, 0.45), 0.6), 0.64);
  // Plain white cards on a light page (a soft grey when the page itself is white).
  const pale = isLightCards
    ? darkPage
      ? hslToHex(hue, tint, 0.93)
      : l > 0.97
        ? "#F3F2EE"
        : "#FFFFFF"
    : hslToHex(hue, Math.min(tint, 0.25), darkPage ? Math.min(l + 0.05, 0.3) : 0.17);
  return { id: "own", name: "Your own colour", bg, hero, pop, pale };
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** A palette's shades as tile colours. Text on the soft tiles is the palette's deepest colour when it reads (finer than black), else black or white. */
function paletteTiles(palette: Palette): Record<string, string> {
  const hero = readable(palette.hero, relativeLuminance(palette.hero) > 0.4 ? "lighter" : "darker");
  const pop = readable(palette.pop, "lighter");
  const deep = relativeLuminance(palette.hero) < relativeLuminance(palette.bg) ? palette.hero : palette.bg;
  const on = (tile: string) => (contrast(tile, deep) >= 4.5 ? deep : textOn(tile));
  return {
    "--tile-hero": hero,
    "--tile-on-hero": textOn(hero),
    "--tile-pop": pop,
    "--tile-on-pop": on(pop),
    "--tile-pale": palette.pale,
    "--tile-on-pale": on(palette.pale),
  };
}

export interface Theme {
  vars: Record<string, string>;
  isLightCards: boolean;
  /** The feedback accent, needed as a JS value for the card icon tint. */
  accentBlue: string;
  style: LandingStyle | null;
}

/**
 * Brand colour drives everything: an unset colour means white, never the
 * visitor's OS theme, so one venue looks the same to every customer.
 * Page text follows the real background. Cards are always light for now
 * (a saved `appearance` is ignored), so there's no dark theme to keep up.
 */
export function computeTheme(branding: VenueBranding): Theme {
  const raw = branding.backgroundColorHex?.trim() ?? "";
  const bg = hexToRgb(raw) ? `#${raw.replace(/^#/, "")}` : "#FFFFFF";
  const isLightReal = isLightColor(bg);
  const isLightCards = true;
  const cards = isLightCards ? LIGHT_CARDS : DARK_CARDS;
  // "editorial" was retired: a page that saved it gets the default face.
  const style = branding.style === "classic" || branding.style === "modern" ? branding.style : null;
  return {
    vars: {
      "--page-bg": bg,
      "--logo-border-color": bg,
      ...textVars("text", isLightReal),
      ...textVars("card-text", isLightCards),
      ...cards,
      ...tilePalette(branding, isLightCards),
    },
    isLightCards,
    accentBlue: cards["--accent-blue"],
    style,
  };
}

/**
 * The theme as a `:root` rule, rendered into the server HTML so the first
 * paint already has the venue's colours. Every value is either a constant or
 * a colour that passed `hexToRgb`, so nothing merchant-typed reaches the CSS.
 */
export function themeCss(theme: Theme): string {
  const declarations = Object.entries(theme.vars).map(([name, value]) => `${name}:${value}`);
  return `:root{${declarations.join(";")}}`;
}

