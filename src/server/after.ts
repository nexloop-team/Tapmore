import "server-only";
import { after } from "next/server";
import { reportError } from "./monitoring";

/**
 * Work the response doesn't need to wait for (emails, bookkeeping): inside
 * a request it runs once the response is on its way, and the host keeps the
 * function alive until it finishes. Outside one (unit tests, jobs) it runs
 * now and the returned promise waits for it, so order stays predictable.
 * A failure is logged, never thrown at the caller.
 */
export async function afterResponse(label: string, task: () => Promise<unknown>): Promise<void> {
  const run = async () => {
    try {
      await task();
    } catch (error) {
      reportError(error, `after: ${label}`);
    }
  };
  try {
    after(run);
  } catch {
    await run(); // not inside a request
  }
}
