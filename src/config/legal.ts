import { BRAND } from "./brand";

/**
 * The business behind Tapmore, as the legal pages and the Contact page
 * print it. Indian law expects these on the site: the Consumer Protection
 * (E-Commerce) Rules 2020 (legal name, address, contact details) and the
 * DPDP Act 2023, and Razorpay checks them before activating payments. (A
 * named Grievance Officer is left out for now: owner's decision, 2026-10-09.)
 *
 * Read at request time, so a change of environment needs a restart, not a
 * rebuild. Startup warns in production while any required one is missing,
 * and the pages show the gap rather than inventing a value.
 */
interface LegalDetails {
  /**
   * The business that runs Tapmore, as its own business (not under any other
   * company): a partnership firm, a proprietor "trading as Tapmore", or
   * later a company. Shown only in the legal fine print, the Contact page
   * and on payments.
   */
  entityName: string;
  /** What kind of business it is, in words: "a partnership firm", "a sole proprietorship". */
  entityType: string | null;
  /** Name and kind together, for sentences: "Tapmore, a partnership firm". */
  entityLabel: string;
  /** Its registration, printed as given when set: "Udyam UDYAM-MH-00-0000000", a firm registration number, or later a CIN / LLPIN. */
  registration: string | null;
  /** Registered office or principal place of business, in full with PIN code. */
  address: string;
  /** City whose courts hear disputes, e.g. "Pune". */
  jurisdictionCity: string;
  supportEmail: string;
  supportPhone: string;
  /** e.g. "Monday to Saturday, 10 am to 6 pm IST". */
  supportHours: string;
  gstin: string | null;
}

const REQUIRED = {
  LEGAL_ENTITY_NAME: "business name",
  LEGAL_ADDRESS: "registered address",
  LEGAL_JURISDICTION_CITY: "city for the courts",
  SUPPORT_PHONE: "support phone number",
} as const;

const missing = (what: string) => `[${what} not set]`;

export function legalDetails(): LegalDetails {
  const env = (key: keyof typeof REQUIRED) => process.env[key]?.trim() || missing(REQUIRED[key]);
  const entityName = env("LEGAL_ENTITY_NAME");
  const entityType = process.env.LEGAL_ENTITY_TYPE?.trim() || null;
  return {
    entityName,
    entityType,
    entityLabel: entityType ? `${entityName}, ${entityType}` : entityName,
    registration: process.env.LEGAL_REGISTRATION?.trim() || null,
    address: env("LEGAL_ADDRESS"),
    jurisdictionCity: env("LEGAL_JURISDICTION_CITY"),
    supportEmail: BRAND.supportEmail,
    supportPhone: env("SUPPORT_PHONE"),
    supportHours: process.env.SUPPORT_HOURS?.trim() || "Monday to Saturday, 10 am to 6 pm IST",
    gstin: process.env.GSTIN?.trim() || null,
  };
}

/**
 * True when another business runs Tapmore (a proprietor "trading as
 * Tapmore", or a parent company), so the pages say "operated by …"; false
 * when the business is Tapmore itself (a firm or company named Tapmore).
 */
export function operatedByOther(legal: LegalDetails): boolean {
  return !legal.entityName.toLowerCase().startsWith(BRAND.name.toLowerCase());
}

/** The required details that aren't set, for the startup check. */
export function missingLegalDetails(): string[] {
  return (Object.keys(REQUIRED) as (keyof typeof REQUIRED)[]).filter((key) => !process.env[key]?.trim());
}

/** Shown at the top of every legal page; change it whenever a policy's wording changes. */
export const POLICIES_UPDATED = "18 October 2026";
