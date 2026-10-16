import "server-only";
import type { Db } from "../db";
import { findCustomerByConsentToken, setConsent } from "../repositories/customers";

/**
 * Offers consent (the old "Email me offers" box) is no longer asked: joining
 * the membership is agreeing to its emails. Confirmation links already sent
 * still work, so a guest who asked for offers can finish saying yes.
 */
export async function confirmConsent(db: Db, token: string): Promise<boolean> {
  const customer = await findCustomerByConsentToken(db, token);
  if (!customer || customer.marketing_consent !== "pending") return false;
  await setConsent(db, customer.id, "granted", !!customer.age_attested, null);
  return true;
}
