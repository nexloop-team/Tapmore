import { computeTheme, themeCss } from "@/lib/theme";
import type { VenueBranding } from "@/lib/venue/types";

/**
 * Server-rendered venue theme: the colour tokens as a :root rule, so the
 * page never paints in default colours. A style preset's face is self-hosted
 * (app/style-fonts) and picked by CSS.
 */
export function ThemeStyle({ branding }: { branding: VenueBranding }) {
  const theme = computeTheme(branding);
  return <style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />;
}
