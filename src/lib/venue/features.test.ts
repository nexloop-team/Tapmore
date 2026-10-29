import { describe, expect, it } from "vitest";
import { DEMO_VENUES } from "@/server/seed";
import type { PublicVenue } from "./types";
import { applyFeatureOrder, buildFeatures, consentAgeThreshold, coverImages, customFeatureLabel, resolvedTitle, safeImageUrl, sanitiseExternalUrl, wifiView } from "./features";

const [juniper, , bloom] = DEMO_VENUES;

function venue(overrides: Partial<PublicVenue>): PublicVenue {
  return { ...juniper, ...overrides, branding: { ...juniper.branding, ...overrides.branding } };
}

describe("buildFeatures", () => {
  it("puts the merchant's order first and appends unlisted cards in default order", () => {
    expect(buildFeatures(juniper)).toEqual(["loyalty", "google_review", "menu", "wifi", "feedback", "sudoku"]);
  });

  it("always offers feedback, even with nothing else configured", () => {
    const bare = venue({ loyaltyProgram: null, menus: [], wifi: null, branding: { sudokuEnabled: false, showGoogleReviewButton: false, featureOrder: [] } });
    expect(buildFeatures(bare)).toEqual(["feedback"]);
  });

  it("shows loyalty for a rewards-only programme and drops sudoku when disabled", () => {
    expect(buildFeatures(venue({ branding: { sudokuEnabled: false } }))).not.toContain("sudoku");
    expect(buildFeatures(bloom)).toContain("loyalty");
  });

  it("adds custom links and hides ones with unsafe URLs", () => {
    const withBadLink = venue({ externalLinks: [...bloom.externalLinks, { id: "evil", url: "javascript:alert(1)" }] });
    const features = buildFeatures(withBadLink);
    expect(features).toContain("link:lnk_book");
    expect(features).not.toContain("link:evil");
  });

  it("hides the menu card when its external URL is not http(s)", () => {
    const badMenu = venue({ menus: [{ id: "m", name: "M", externalUrl: "ftp://x", sections: [] }] });
    expect(buildFeatures(badMenu)).not.toContain("menu");
  });
});

describe("hidden and renamed cards", () => {
  it("drops hidden cards and keeps the merchant's order for the rest", () => {
    const v = venue({ branding: { hiddenFeatures: ["menu", "feedback"] } });
    expect(buildFeatures(v)).toEqual(["loyalty", "google_review", "wifi", "sudoku"]);
  });

  it("hides a custom link by its link key", () => {
    const v = venue({ externalLinks: bloom.externalLinks, branding: { hiddenFeatures: ["link:lnk_book"] } });
    const features = buildFeatures(v);
    expect(features).not.toContain("link:lnk_book");
    expect(features).toContain("link:lnk_jobs");
  });

  it("ignores hidden keys for cards the venue can't show anyway", () => {
    const v = venue({ wifi: null, branding: { hiddenFeatures: ["wifi", "not-a-card"] } });
    expect(buildFeatures(v)).not.toContain("wifi");
    expect(buildFeatures(v)).toContain("feedback");
  });

  it("uses the merchant's own label when set, ignoring blanks", () => {
    expect(customFeatureLabel(venue({ branding: { featureLabels: { loyalty: "  Coffee club " } } }), "loyalty")).toBe("Coffee club");
    expect(customFeatureLabel(venue({ branding: { featureLabels: { loyalty: "   " } } }), "loyalty")).toBeNull();
    expect(customFeatureLabel(juniper, "wifi")).toBeNull();
  });
});

describe("applyFeatureOrder", () => {
  it("can reorder but never add or duplicate a card", () => {
    expect(applyFeatureOrder(["menu", "feedback"], ["feedback", "wifi", "feedback", "menu"])).toEqual(["feedback", "menu"]);
  });
});

describe("header and helpers", () => {
  it("resolves the title: whitespace override hides it, empty falls back to the name", () => {
    expect(resolvedTitle({ titleOverride: "   " }, "Cafe")).toBeNull();
    expect(resolvedTitle({ titleOverride: "" }, "Cafe")).toBe("Cafe");
    expect(resolvedTitle({}, "  ")).toBeNull();
  });

  it("only allows http(s) links and same-origin images", () => {
    expect(sanitiseExternalUrl(" https://a.b ")).toBe("https://a.b");
    expect(sanitiseExternalUrl("data:text/html,x")).toBeNull();
    expect(safeImageUrl("/demo/x.svg")).toBe("/demo/x.svg");
    expect(safeImageUrl("//evil.com/x.png")).toBeNull();
  });

  it("treats open networks as passwordless and raises the age line for pubs", () => {
    expect(wifiView(bloom)).toMatchObject({ isOpen: true, canCopyPassword: false });
    expect(consentAgeThreshold(venue({ venueType: "pub" }))).toBe(18);
    expect(consentAgeThreshold(juniper)).toBe(13);
  });
});

describe("coverImages", () => {
  it("shows the gallery first, falls back to the single cover, drops unsafe or repeated ones, at most 5", () => {
    expect(coverImages({ coverImageUrl: "/demo/a.svg" })).toEqual(["/demo/a.svg"]);
    expect(coverImages({ coverImageUrls: ["/demo/a.svg", "/demo/b.svg"], coverImageUrl: "/demo/a.svg" })).toEqual(["/demo/a.svg", "/demo/b.svg"]);
    expect(coverImages({ coverImageUrls: ["javascript:alert(1)", "/demo/b.svg"] })).toEqual(["/demo/b.svg"]);
    expect(coverImages({ coverImageUrls: ["1", "2", "3", "4", "5", "6"].map((n) => `/demo/${n}.svg`) })).toHaveLength(5);
  });
});

describe("safeImageUrl", () => {
  it("allows this browser's blob: previews but nothing else unusual", () => {
    expect(safeImageUrl("blob:https://www.tapmore.in/2f1c")).toBe("blob:https://www.tapmore.in/2f1c");
    expect(safeImageUrl("data:image/png;base64,AAAA")).toBeNull();
    expect(safeImageUrl("javascript:alert(1)")).toBeNull();
  });
});
