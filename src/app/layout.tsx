import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { BRAND } from "@/config/brand";
import { LOCALE } from "@/lib/i18n";
import { Suspense } from "react";
import { RealUserSpeed } from "@/components/RealUserSpeed";
import { styleFontVariables } from "./style-fonts";
import "./globals.css";

/**
 * Wordmark face, one weight. Guest pages only use it for the footer lockup;
 * merchant pages also use it for headings and stat numbers. Not preloaded:
 * on a guest page it would compete with the cover photo for a slow connection.
 */
const wordmark = Bricolage_Grotesque({
  variable: "--font-wordmark",
  subsets: ["latin"],
  weight: "700",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  // Absolute links for share previews (Vercel supplies its own address when APP_URL isn't set).
  ...(process.env.APP_URL ? { metadataBase: new URL(process.env.APP_URL) } : {}),
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: "QR-code pages for cafés, bars and restaurants: menus, Wi-Fi, loyalty cards and feedback.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={LOCALE} className={`${wordmark.variable} ${styleFontVariables}`}>
      <body>
        {children}
        {/* Real-world page speed, on Vercel only (where its script is served). */}
        {process.env.VERCEL && (
          <Suspense fallback={null}>
            <RealUserSpeed />
          </Suspense>
        )}
      </body>
    </html>
  );
}
