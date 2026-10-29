/**
 * "98765 43210" or "+91 98765 43210" → "https://wa.me/919876543210", with an
 * optional message typed in for the customer; null when it isn't a phone number.
 * A 10-digit number on a rupee venue is an Indian mobile and gets +91; any
 * other number must already include its country code.
 */
export function whatsappLink(input: string | null | undefined, currencyCode: string, text?: string): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.length === 10 && currencyCode === "INR" ? `91${digits}` : digits;
  if (full.length < 11 || full.length > 15) return null;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
