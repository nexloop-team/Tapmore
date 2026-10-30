import { describe, expect, it } from "vitest";
import { leavingHref } from "./leave-guard";

const here = "https://www.tapmore.in/dashboard/ven_1/design#look";
const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
const link = (href: string, extra: Partial<{ target: string; download: boolean }> = {}) => ({ href, target: "", download: false, ...extra });

describe("leavingHref", () => {
  it("catches a plain click to another dashboard page", () => {
    expect(leavingHref(click, link("/dashboard/ven_1/menu"), here)).toBe("/dashboard/ven_1/menu");
    expect(leavingHref(click, link("https://www.tapmore.in/dashboard/ven_1?days=7"), here)).toBe("/dashboard/ven_1?days=7");
  });

  it("lets jumps within the same page through", () => {
    expect(leavingHref(click, link("#wifi"), here)).toBeNull();
    expect(leavingHref(click, link("/dashboard/ven_1/design#google"), here)).toBeNull();
  });

  it("leaves new tabs, downloads, modified clicks and other sites alone", () => {
    expect(leavingHref(click, link("/dashboard/ven_1/menu", { target: "_blank" }), here)).toBeNull();
    expect(leavingHref(click, link("/dashboard/ven_1/qr", { download: true }), here)).toBeNull();
    expect(leavingHref({ ...click, metaKey: true }, link("/dashboard/ven_1/menu"), here)).toBeNull();
    expect(leavingHref({ ...click, button: 1 }, link("/dashboard/ven_1/menu"), here)).toBeNull();
    expect(leavingHref({ ...click, defaultPrevented: true }, link("/dashboard/ven_1/menu"), here)).toBeNull();
    expect(leavingHref(click, link("https://instagram.com/x"), here)).toBeNull();
  });
});
