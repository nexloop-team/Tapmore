import { describe, expect, it } from "vitest";
import { parseTables, printFormats, printVenue, ringName, scanLine, sheetCount } from "./PrintSheets";

const branding = { backgroundColorHex: "#FFFFFF" };

describe("print sheets", () => {
  it("say the same scan line on cards and tents, in the business's words", () => {
    expect(scanLine(["Menu", "Wi-Fi", "your stamp card"], true)).toBe("Scan for the menu, Wi‑Fi & stamp card");
    expect(scanLine(["Services", "your stamp card"], false)).toBe("Scan for our services & stamp card");
    expect(scanLine(["Products"], false)).toBe("Scan for our products");
    expect(scanLine([], false)).toBe("Scan for everything in one place");
  });

  it("never cut a sticker's name mid-word", () => {
    expect(ringName("Glow Hair & Beauty Studio Baner")).toBe("GLOW HAIR & BEAUTY STUDIO");
    expect(ringName("Juniper Coffee House")).toBe("JUNIPER COFFEE HOUSE");
    expect(ringName("Supercalifragilisticexpialidocious Cafe")).toHaveLength(26);
  });

  it("offer Wi-Fi signs only when the page shares the Wi-Fi", () => {
    const shop = printVenue("v1", { name: "Sharma Store", venueType: "shop", branding, menus: [{}], wifi: null });
    expect(printFormats(shop)).toEqual(["a6", "tent", "sticker"]);
    const cafe = printVenue("v2", { name: "Juniper", venueType: "cafe", branding, menus: [{}], wifi: { ssid: "Juniper-Guest" } });
    expect(printFormats(cafe)).toContain("wifi");
  });

  it("number cards from a range or list, in the business's word", () => {
    expect(parseTables("1-3", "Counter")).toEqual(["Counter 1", "Counter 2", "Counter 3"]);
    expect(parseTables("2, Billing", "Counter")).toEqual(["Counter 2", "Billing"]);
    expect(parseTables("1-500").length).toBe(100);
  });

  it("count the A4 sheets a run needs", () => {
    expect(sheetCount("a6", 4)).toBe(1);
    expect(sheetCount("a6", 5)).toBe(2);
    expect(sheetCount("sticker", 6)).toBe(1);
  });
});
