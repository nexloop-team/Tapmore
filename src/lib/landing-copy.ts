import type { EnrollResponse } from "./api/contracts";
import type { MessageKey, Translate, TranslateFormat } from "./i18n";
import { maskEmail } from "./validation";
import type { LinkLabelToken } from "./venue/types";

const LINK_LABELS: Record<LinkLabelToken, MessageKey> = {
  view_menu: "feature_menu",
  view_price_list: "feature_menu_pricelist",
  our_services: "feature_menu_services",
  book_now: "feature_menu_booknow",
  visit_website: "feature_menu_website",
  order_online: "feature_menu_orderonline",
};

/**
 * Label for the menu card or a custom link: the merchant's own words win,
 * then a known token, then `fallback`. Unknown tokens never reach the page.
 */
export function linkLabel(token: string | null | undefined, custom: string | null | undefined, t: Translate, fallback: MessageKey): string {
  const own = custom?.trim();
  if (own) return own;
  const key = token && Object.hasOwn(LINK_LABELS, token) ? LINK_LABELS[token as LinkLabelToken] : null;
  return t(key ?? fallback);
}

/**
 * What a stamp-card join says about the email. A returning member is emailed
 * again at once; only past the resend cap are they pointed at the emails
 * they already have.
 */
export function enrolEmailCopy(response: EnrollResponse, email: string, t: Translate, tf: TranslateFormat): string {
  if (response.passEmailed) return tf("pass_sent_to", { email: maskEmail(email) });
  if (response.wasExisting) return tf("pass_recently_sent", { email: maskEmail(email) });
  return t("pass_not_emailed");
}

/**
 * The one sentence a rewards join may say about the pass. Empty when a button
 * beside it already says it; `renderButtons: false` (the Wi-Fi gate, where the
 * guest is mid-connection) always names where the card went instead.
 */
export function rewardsPassLine(response: EnrollResponse, email: string, renderButtons: boolean, tf: TranslateFormat): string {
  const inHand = renderButtons && !!response.cardUrl;
  if (inHand) return "";
  if (response.passEmailed) return tf("pass_on_its_way", { email: maskEmail(email) });
  return tf(response.wasExisting ? "pass_recently_sent" : "pass_not_emailed", { email: maskEmail(email) });
}
