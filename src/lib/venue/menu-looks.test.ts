import { describe, expect, it } from "vitest";
import { MENU_LOOKS, menuLook } from "./menu-looks";
import { whatsappLink } from "./whatsapp";

describe("menu looks", () => {
  it("default to a look made for the kind of business", () => {
    expect(menuLook(null, "food")).toBe("list");
    expect(menuLook(null, "retail")).toBe("grid");
    expect(menuLook(null, "service")).toBe("service");
  });

  it("keep a chosen look, and fall back when it was made for another kind", () => {
    expect(menuLook("classic", "food")).toBe("classic");
    expect(menuLook("simple", "retail")).toBe("simple");
    expect(menuLook("classic", "service")).toBe("classic");
    // A café turned shop doesn't keep the printed-menu look; a shop turned café doesn't keep the compact list.
    expect(menuLook("classic", "retail")).toBe("grid");
    expect(menuLook("simple", "food")).toBe("list");
  });

  it("offer two looks per kind, the default first", () => {
    for (const options of Object.values(MENU_LOOKS)) {
      expect(options).toHaveLength(2);
      expect(options[0].layout).toBeNull();
    }
  });
});

describe("WhatsApp links", () => {
  it("add +91 to an Indian mobile and carry the message", () => {
    expect(whatsappLink("98765 43210", "INR")).toBe("https://wa.me/919876543210");
    expect(whatsappLink("+91 98765-43210", "INR", "Hi, I'm interested in Teak sofa (₹45,000).")).toBe(
      "https://wa.me/919876543210?text=Hi%2C%20I'm%20interested%20in%20Teak%20sofa%20(%E2%82%B945%2C000).",
    );
  });

  it("refuse what isn't a phone number", () => {
    expect(whatsappLink("", "INR")).toBeNull();
    expect(whatsappLink("12345", "INR")).toBeNull();
    expect(whatsappLink("9876543210", "GBP")).toBeNull();
  });
});
