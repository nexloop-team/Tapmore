import { Outfit, Playfair_Display } from "next/font/google";

/**
 * The style presets' display faces (see lib/theme), served from our own
 * domain instead of Google's: no render-blocking stylesheet and no extra
 * connections on a guest's phone. Nothing is preloaded, and a browser only
 * downloads a face when a page actually uses it. Each is a variable font,
 * so one file covers every weight.
 */
const classic = Playfair_Display({ variable: "--font-classic", subsets: ["latin", "latin-ext"], display: "swap", preload: false });
const modern = Outfit({ variable: "--font-modern", subsets: ["latin", "latin-ext"], display: "swap", preload: false });

/** Classes that define --font-classic and --font-modern. */
export const styleFontVariables = [classic.variable, modern.variable].join(" ");
