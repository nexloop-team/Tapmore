import { describe, expect, it } from "vitest";
import { tileSizes } from "@/components/landing/tiles";
import { PALETTES, findPalette } from "./palettes";
import { relativeLuminance, tilePalette } from "./theme";

const contrast = (a: string, b: string) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("bento tile sizes", () => {
  it("puts loyalty across the top and the menu tall beside the next two", () => {
    expect(tileSizes(["loyalty", "menu", "wifi", "feedback", "google_review", "sudoku"])).toEqual({
      loyalty: "wide",
      menu: "tall",
      wifi: "small",
      feedback: "small",
      google_review: "small",
      sudoku: "small",
    });
  });

  it("never leaves a hole: an odd tile out takes the whole row", () => {
    expect(tileSizes(["menu", "wifi"])).toEqual({ menu: "small", wifi: "small" });
    expect(tileSizes(["menu", "wifi", "feedback", "sudoku"])).toMatchObject({ menu: "tall", sudoku: "wide" });
    expect(tileSizes(["wifi", "loyalty", "feedback"])).toEqual({ wifi: "wide", loyalty: "wide", feedback: "wide" });
  });
});

describe("tile palette", () => {
  const pages = ["#FFFFFF", "#F6E7D8", "#DDE6DA", "#1F2A24", "#1F3A5F", "#111111", "#B5523B"];

  it("keeps text readable on every shade, on every page colour", () => {
    for (const page of pages) {
      for (const light of [true, false]) {
        const p = tilePalette({ backgroundColorHex: page }, light);
        expect(contrast(p["--tile-hero"], p["--tile-on-hero"]), `${page} hero`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p["--tile-pop"], p["--tile-on-pop"]), `${page} pop`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p["--tile-pale"], p["--tile-on-pale"]), `${page} pale`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("sets the tiles apart from the page", () => {
    for (const page of pages) {
      const p = tilePalette({ backgroundColorHex: page }, relativeLuminance(page) > 0.45);
      expect(p["--tile-pale"], page).not.toBe(page.toUpperCase());
      expect(contrast(p["--tile-hero"], page), `${page} hero vs page`).toBeGreaterThan(1.3);
    }
  });
});

describe("tile colours", () => {
  const hue = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    if (!d) return 0;
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return h * 60;
  };

  it("keeps text readable on every tile of every palette", () => {
    for (const palette of PALETTES) {
      const p = tilePalette({ backgroundColorHex: palette.bg, palette: palette.id }, true);
      for (const tile of ["hero", "pop", "pale"]) {
        expect(contrast(p[`--tile-${tile}`], p[`--tile-on-${tile}`]), `${palette.id} ${tile}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("sets every palette's tiles apart from its page", () => {
    for (const palette of PALETTES) {
      expect(contrast(palette.hero, palette.bg), `${palette.id} hero`).toBeGreaterThan(1.3);
      expect(contrast(palette.pale, palette.bg), `${palette.id} pale`).toBeGreaterThan(1.05);
    }
  });

  it("uses the palette's own shades and ignores an old picked tile colour", () => {
    const linen = findPalette("stone")!;
    const p = tilePalette({ backgroundColorHex: linen.bg, palette: linen.id, tileSource: "custom", tileColorHex: "#4A2545" }, true);
    expect(p["--tile-hero"]).toBe(linen.hero);
    expect(p["--tile-pale"]).toBe(linen.pale);
  });

  it("works the shades out from a custom page colour, so green stays green", () => {
    const p = tilePalette({ backgroundColorHex: "#DDE6DA", tileSource: "custom", tileColorHex: "#4A2545" }, true);
    expect(p).toEqual(tilePalette({ backgroundColorHex: "#DDE6DA" }, true));
    expect(Math.abs(hue(p["--tile-hero"]) - hue("#DDE6DA"))).toBeLessThan(12);
    for (const tile of ["hero", "pop", "pale"]) expect(contrast(p[`--tile-${tile}`], p[`--tile-on-${tile}`])).toBeGreaterThanOrEqual(4.5);
  });

  it("finds palettes by id and nothing for an unknown one", () => {
    expect(findPalette("stone")?.bg).toBe("#E8E4DD");
    expect(findPalette("coffee-house")).toBeNull();
    expect(findPalette("nope")).toBeNull();
    expect(new Set(PALETTES.map((palette) => palette.id)).size).toBe(PALETTES.length);
  });
});
