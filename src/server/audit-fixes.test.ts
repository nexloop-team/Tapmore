import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { stampRequest } from "@/lib/api/contracts";

// A cookie jar standing in for the request's cookies (till devices read theirs).
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => new Headers(),
}));

// db.ts reads DATA_DIR on load, so point it at a scratch directory first.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tapmore-audit-"));
process.env.DATA_DIR = dataDir;

type M = {
  db: typeof import("./db");
  users: typeof import("./repositories/users");
  admin: typeof import("./services/venue-admin");
  schema: typeof import("@/lib/venue/schema");
  venues: typeof import("./repositories/venues");
  loyalty: typeof import("./services/loyalty");
  feedback: typeof import("./services/feedback");
  guests: typeof import("./services/guests");
  customers: typeof import("./repositories/customers");
  staff: typeof import("./services/staff");
  cards: typeof import("./repositories/loyalty-cards");
  housekeeping: typeof import("./jobs/housekeeping");
  mailer: typeof import("./services/mailer");
  http: typeof import("./http");
  features: typeof import("@/lib/venue/features");
  settings: typeof import("@/lib/venue/settings");
};
let m: M;

beforeAll(async () => {
  m = {
    db: await import("./db"),
    users: await import("./repositories/users"),
    admin: await import("./services/venue-admin"),
    schema: await import("@/lib/venue/schema"),
    venues: await import("./repositories/venues"),
    loyalty: await import("./services/loyalty"),
    feedback: await import("./services/feedback"),
    guests: await import("./services/guests"),
    customers: await import("./repositories/customers"),
    staff: await import("./services/staff"),
    cards: await import("./repositories/loyalty-cards"),
    housekeeping: await import("./jobs/housekeeping"),
    mailer: await import("./services/mailer"),
    http: await import("./http"),
    features: await import("@/lib/venue/features"),
    settings: await import("@/lib/venue/settings"),
  };
});

afterAll(async () => {
  await m.db.closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

let seq = 0;
async function stampVenue(extra: NonNullable<Parameters<typeof import("./services/venue-admin").updateVenue>[1]["config"]> = {}) {
  seq += 1;
  const owner = await m.users.insertUser({ email: `audit-owner${seq}@example.com`, name: "Owner", passwordHash: "x" });
  const venue = await m.admin.createVenueForUser(owner, m.schema.createVenueRequest.parse({ name: `Audit Cafe ${seq}`, venueType: "cafe", currencyCode: "INR", loyalty: { rewardName: "Free chai", stampsRequired: 5 } }));
  return extra && Object.keys(extra).length ? await m.admin.updateVenue(venue, { config: extra }) : venue;
}

const ORIGIN = "https://tapmore.test";

describe("feedback stamps", () => {
  it("need a receipt from real feedback, once, and never by email alone", async () => {
    const venue = await stampVenue();
    const joined = await m.loyalty.enroll({ venueId: venue.id, email: "fb@example.com", firstName: "Fe" }, ORIGIN);
    // No receipt: the old "email only" request is refused by the contract itself.
    expect(stampRequest.safeParse({ venueId: venue.id, email: "fb@example.com" }).success).toBe(false);

    const posted = await m.feedback.submitFeedback({ venueId: venue.id, text: "Lovely chai" });
    expect(posted.stampReceipt).not.toBeNull();
    const receipt = posted.stampReceipt!;
    const wrong = await m.loyalty.stampForFeedback({ venueId: venue.id, email: "fb@example.com", feedbackReceipt: { ...receipt, token: "x".repeat(32) } });
    expect(wrong.stamped).toBe(false);
    const first = await m.loyalty.stampForFeedback({ venueId: venue.id, email: "fb@example.com", feedbackReceipt: receipt });
    expect(first).toEqual({ stamped: true, currentStamps: 1 });
    // The same receipt can't be used again, even for another member.
    await m.loyalty.enroll({ venueId: venue.id, email: "other@example.com" }, ORIGIN);
    expect((await m.loyalty.stampForFeedback({ venueId: venue.id, email: "other@example.com", feedbackReceipt: receipt })).stamped).toBe(false);
    expect(joined.cardId).toBeTruthy();
  });

  it("can be claimed with the card on the member's phone, still once per member", async () => {
    const venue = await stampVenue();
    const joined = await m.loyalty.enroll({ venueId: venue.id, email: "fb-card@example.com" }, ORIGIN);
    const card = { cardId: joined.cardId, token: new URLSearchParams(joined.cardUrl!.split("?")[1]).get("t")! };
    const claim = async (proof: { card: typeof card }) => {
      const { stampReceipt } = await m.feedback.submitFeedback({ venueId: venue.id, text: "Lovely" });
      return (await m.loyalty.stampForFeedback({ venueId: venue.id, ...proof, feedbackReceipt: stampReceipt! })).stamped;
    };
    expect(await claim({ card: { ...card, token: "x".repeat(32) } })).toBe(false);
    expect(await claim({ card })).toBe(true);
    expect(await claim({ card })).toBe(false);
    expect(stampRequest.safeParse({ venueId: venue.id, feedbackReceipt: { feedbackId: "fbk_x", token: "y".repeat(32) } }).success).toBe(false);
  });

  it("are once per member, ever: later feedback earns nothing", async () => {
    const venue = await stampVenue();
    await m.loyalty.enroll({ venueId: venue.id, email: "fb-once@example.com" }, ORIGIN);
    const claim = async () => {
      const { stampReceipt } = await m.feedback.submitFeedback({ venueId: venue.id, text: "Nice" });
      return (await m.loyalty.stampForFeedback({ venueId: venue.id, email: "fb-once@example.com", feedbackReceipt: stampReceipt! })).stamped;
    };
    expect(await claim()).toBe(true);
    // Days later, from anywhere: no more stamps for feedback.
    const db = await m.db.getDb();
    await db.run("UPDATE loyalty_cards SET last_feedback_stamp_at = now() - INTERVAL '10 days' WHERE venue_id = ?", venue.id);
    expect(await claim()).toBe(false);

    // Joining after feedback with its free stamp counts as the once.
    const { stampReceipt } = await m.feedback.submitFeedback({ venueId: venue.id, text: "Good" });
    await m.loyalty.enroll({ venueId: venue.id, email: "fb-join@example.com", initialStamps: 1, captureSource: "feedback", feedbackReceipt: stampReceipt! }, ORIGIN);
    const later = await m.feedback.submitFeedback({ venueId: venue.id, text: "Again" });
    expect((await m.loyalty.stampForFeedback({ venueId: venue.id, email: "fb-join@example.com", feedbackReceipt: later.stampReceipt! })).stamped).toBe(false);
  });

  it("are off when the owner switches them off", async () => {
    const venue = await stampVenue();
    await m.venues.saveVenueSettings(venue.id, { ...(await m.venues.getVenueSettings(venue.id)), stampPolicy: { cooldownMinutes: 30, feedbackStamp: false } });
    expect((await m.feedback.submitFeedback({ venueId: venue.id, text: "Fine" })).stampReceipt).toBeNull();
  });

  it("a join only gets its stamp from a feedback receipt", async () => {
    const venue = await stampVenue();
    const plain = await m.loyalty.enroll({ venueId: venue.id, email: "free@example.com", initialStamps: 1, captureSource: "landing" }, ORIGIN);
    const noReceipt = await m.loyalty.enroll({ venueId: venue.id, email: "fb2@example.com", initialStamps: 1, captureSource: "feedback" }, ORIGIN);
    const { stampReceipt } = await m.feedback.submitFeedback({ venueId: venue.id, text: "Good" });
    const withReceipt = await m.loyalty.enroll({ venueId: venue.id, email: "fb3@example.com", initialStamps: 1, captureSource: "feedback", feedbackReceipt: stampReceipt! }, ORIGIN);
    const db = await m.db.getDb();
    const stamps = async (cardId: string) => (await m.cards.findCardById(db, cardId))!.stamps;
    expect(await stamps(plain.cardId)).toBe(0);
    expect(await stamps(noReceipt.cardId)).toBe(0);
    expect(await stamps(withReceipt.cardId)).toBe(1);
  });
});

describe("returning members", () => {
  it("are emailed their card instead of being shown it", async () => {
    const venue = await stampVenue();
    const first = await m.loyalty.enroll({ venueId: venue.id, email: "back@example.com" }, ORIGIN);
    expect(first.cardUrl).toContain("/card/");
    const again = await m.loyalty.enroll({ venueId: venue.id, email: "back@example.com" }, ORIGIN);
    expect(again.wasExisting).toBe(true);
    expect(again.cardUrl).toBeNull();
    // Typing someone's email doesn't hand out their guest id (which unlocks the birthday and visit endpoints).
    expect(first.customerId).toBeTruthy();
    expect(again.customerId).toBeNull();
  });

  it("get their card emailed again at once on a new phone, a few times an hour at most", async () => {
    const venue = await stampVenue();
    const join = () => m.loyalty.enroll({ venueId: venue.id, email: "new-phone@example.com" }, ORIGIN);
    expect((await join()).passEmailed).toBe(true);
    // Straight after joining, a "new phone" gets the card again: no waiting.
    const resends = [await join(), await join(), await join(), await join()].map((r) => r.passEmailed);
    expect(resends).toEqual([true, true, true, false]);
    const db = await m.db.getDb();
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE recipient = 'new-phone@example.com'"))!.n).toBe(4);
  });

  it("can't have a birthday added by someone re-joining with their email", async () => {
    const venue = await stampVenue({ crm: { enabled: true, wifiCapture: false, feedbackCapture: false, birthdayAsk: true } });
    const join = (birthday?: { month: number; day: number }) =>
      m.loyalty.enroll({ venueId: venue.id, email: "no-bday@example.com", birthday }, ORIGIN);
    const first = await join();
    await join({ month: 3, day: 3 });
    const db = await m.db.getDb();
    const row = (await m.customers.findCustomerById(db, venue.id, first.customerId!))!;
    expect(row.birthday_month).toBeNull();
    // A new member's own birthday, given as they join, is kept.
    const fresh = await m.loyalty.enroll({ venueId: venue.id, email: "has-bday@example.com", birthday: { month: 7, day: 21 } }, ORIGIN);
    const saved = (await m.customers.findCustomerById(db, venue.id, fresh.customerId!))!;
    expect([saved.birthday_month, saved.birthday_day]).toEqual([7, 21]);
  });

  it("get their birthday treat on the card and at the till on the day, with or without offers", async () => {
    // Birthdays asked, marketing consent not asked at all.
    const venue = await stampVenue({ crm: { enabled: true, wifiCapture: false, feedbackCapture: false, birthdayAsk: true } });
    await m.venues.saveVenueSettings(venue.id, {
      ...(await m.venues.getVenueSettings(venue.id)),
      automations: { birthday: { enabled: true, offer: "A free coffee on your birthday" } },
    });
    // Today in the venue's own time zone (INR: India).
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", month: "numeric", day: "numeric" }).formatToParts(new Date());
    const [month, day] = ["month", "day"].map((type) => Number(today.find((part) => part.type === type)!.value));
    const joined = await m.loyalty.enroll({ venueId: venue.id, email: "bday-today@example.com", birthday: { month, day } }, ORIGIN);
    const db = await m.db.getDb();
    const saved = (await m.customers.findCustomerById(db, venue.id, joined.customerId!))!;
    expect([saved.birthday_month, saved.birthday_day]).toEqual([month, day]);

    const { memberCardView } = await import("./services/card");
    const token = new URLSearchParams(joined.cardUrl!.split("?")[1]).get("t")!;
    const onCard = async () => (await memberCardView(joined.cardId, token, ORIGIN))!.birthdayTreat;
    (await db.run("INSERT INTO staff_devices (id, venue_id, label) VALUES (?, ?, 'Till')", `bday_${seq}`, venue.id));
    const device = { id: `bday_${seq}`, venueId: venue.id, label: "Till" };
    const atTill = async () => (await m.staff.viewCard(device, joined.cardId)).birthday;

    // On the day: on the card and at the till (staff check ID when it's collected).
    expect(await onCard()).toBe("A free coffee on your birthday");
    expect(await atTill()).toEqual({ reward: "A free coffee on your birthday", given: false });

    // Given once at the till: gone from the card, marked given, and can't be given twice.
    await m.staff.giveBirthdayReward(device, joined.cardId);
    expect(await atTill()).toEqual({ reward: "A free coffee on your birthday", given: true });
    expect(await onCard()).toBeNull();
    await expect(m.staff.giveBirthdayReward(device, joined.cardId)).rejects.toThrow(/already been given/i);
    // A slip can be undone like a stamp, and the stamps don't move.
    const before = (await m.cards.findCardById(db, joined.cardId))!.stamps;
    await m.staff.undoLast(device, joined.cardId);
    expect(await atTill()).toEqual({ reward: "A free coffee on your birthday", given: false });
    expect((await m.cards.findCardById(db, joined.cardId))!.stamps).toBe(before);

    // Birthdays no longer asked: no reward either, even on the day.
    const record = (await m.venues.getVenueRecord(venue.id))!;
    await m.admin.updateVenue(record, { config: { crm: { ...record.config.crm, birthdayAsk: false } } });
    expect(await onCard()).toBeNull();
    await m.admin.updateVenue((await m.venues.getVenueRecord(venue.id))!, { config: { crm: { ...record.config.crm, birthdayAsk: true } } });

    // Staff correct the date at the till: any other day, nothing shows.
    const otherMonth = month === 1 ? 2 : 1;
    const corrected = await m.staff.setGuestBirthday(device, joined.cardId, otherMonth, 15);
    expect(corrected.birthdayDate).toEqual({ month: otherMonth, day: 15 });
    expect(await onCard()).toBeNull();
    await expect(m.staff.setGuestBirthday(device, joined.cardId, 2, 30)).rejects.toThrow(/doesn't exist/i);
    // Changing it back can't earn a second reward this year.
    await m.staff.setGuestBirthday(device, joined.cardId, month, day);
    await m.staff.giveBirthdayReward(device, joined.cardId);
    await m.staff.setGuestBirthday(device, joined.cardId, month, day);
    expect(await atTill()).toEqual({ reward: "A free coffee on your birthday", given: true });
  });

  it("keep the birthday they gave first", async () => {
    const venue = await stampVenue();
    const db = await m.db.getDb();
    const { customer } = await m.customers.upsertCustomer(db, { venueId: venue.id, email: "bday@example.com", captureSource: "landing" });
    await m.customers.setBirthday(db, customer.id, 3, 14);
    await m.customers.setBirthday(db, customer.id, 12, 1);
    const row = (await m.customers.findCustomerById(db, venue.id, customer.id))!;
    expect([row.birthday_month, row.birthday_day]).toEqual([3, 14]);
  });
});

describe("guest erasure", () => {
  it("removes the guest, card, stamps and visits", async () => {
    const venue = await stampVenue();
    const joined = await m.loyalty.enroll({ venueId: venue.id, email: "gone@example.com" }, ORIGIN);
    const ok = await m.db.transaction((db) => m.customers.deleteGuest(db, venue.id, joined.customerId!));
    expect(ok).toBe(true);
    const db = await m.db.getDb();
    expect(await m.customers.findCustomerById(db, venue.id, joined.customerId!)).toBeNull();
    expect(await m.cards.findCardById(db, joined.cardId)).toBeNull();
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM stamp_events WHERE card_id = ?", joined.cardId))!.n).toBe(0);
  });
});

describe("Wi-Fi gate", () => {
  it("is off unless the owner switches it on: everyone sees the password", async () => {
    const venue = await stampVenue({ wifi: { ssid: "Cafe", password: "open-sesame", security: "WPA2" } });
    const live = (await m.venues.findVenue(venue.id))!;
    expect(m.features.wifiGateActive(live)).toBe(false);
    expect(m.features.guestSafeVenue(live).wifi?.password).toBe("open-sesame");
    await expect(m.guests.captureGuest({ venueId: venue.id, email: "no-gate@example.com" })).rejects.toThrow(/doesn't ask/);
  });

  it("counts at most one Wi-Fi visit a day, however often the gate is passed", async () => {
    const venue = await stampVenue({
      wifi: { ssid: "Cafe", password: "pw", security: "WPA2" },
      crm: { enabled: true, wifiCapture: true, feedbackCapture: false, birthdayAsk: false },
    });
    const capture = () => m.guests.captureGuest({ venueId: venue.id, email: "repeat@example.com" });
    const { customerId } = await capture();
    await capture();
    await m.guests.recordGuestVisit({ venueId: venue.id, customerId, type: "wifi_tap" });
    const db = await m.db.getDb();
    const visits = async () => (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM visits WHERE customer_id = ?", customerId))!.n;
    expect(await visits()).toBe(1);
    await db.run("UPDATE visits SET created_at = now() - INTERVAL '1 day' WHERE customer_id = ?", customerId);
    await capture();
    expect(await visits()).toBe(2);
  });

  it("gives a loyalty member the password with the card on their phone, no email asked", async () => {
    const gate = { enabled: true, wifiCapture: true, feedbackCapture: false, birthdayAsk: false };
    const venue = await stampVenue({ wifi: { ssid: "Cafe", password: "member-pass", security: "WPA2" }, crm: gate });
    const joined = await m.loyalty.enroll({ venueId: venue.id, email: "wifi-member@example.com" }, ORIGIN);
    const [, query] = joined.cardUrl!.split("?");
    const card = { cardId: joined.cardId, token: new URLSearchParams(query).get("t")! };
    expect((await m.guests.wifiPassword({ venueId: venue.id, card })).password).toBe("member-pass");
    // A wrong token, or a card from another café, is refused.
    await expect(m.guests.wifiPassword({ venueId: venue.id, card: { ...card, token: "x".repeat(32) } })).rejects.toThrow(/unknown guest/i);
    const other = await stampVenue({ wifi: { ssid: "Other", password: "other-pass", security: "WPA2" }, crm: gate });
    await expect(m.guests.wifiPassword({ venueId: other.id, card })).rejects.toThrow(/unknown guest/i);
    // The card counts the Wi-Fi visit for its holder.
    await m.guests.recordGuestVisit({ venueId: venue.id, card, type: "wifi_tap" });
    const db = await m.db.getDb();
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM visits WHERE customer_id = ?", joined.customerId))!.n).toBe(1);
  });

  it("keeps the password out of the page until the guest has given an email", async () => {
    const venue = await stampVenue({
      wifi: { ssid: "Cafe", password: "s3cret-pass", security: "WPA2" },
      crm: { enabled: true, wifiCapture: true, feedbackCapture: false, birthdayAsk: false },
    });
    const live = (await m.venues.findVenue(venue.id))!;
    expect(m.features.guestSafeVenue(live).wifi?.password).toBeNull();
    const captured = await m.guests.captureGuest({ venueId: venue.id, email: "wifi-guest@example.com" });
    expect((await m.guests.wifiPassword({ venueId: venue.id, customerId: captured.customerId })).password).toBe("s3cret-pass");
    await expect(m.guests.wifiPassword({ venueId: venue.id, customerId: "cus_unknown" })).rejects.toThrow(/unknown guest/i);
  });
});

describe("page addresses", () => {
  it("keep old codes pointing at their venue, and never let anyone else take them", async () => {
    const venue = await stampVenue();
    const oldCode = venue.shortCode;
    await m.admin.updateVenue(venue, { shortCode: `${oldCode}-new` });
    expect((await m.venues.findVenue(oldCode))?.id).toBe(venue.id);
    expect(await m.venues.shortCodeTaken(oldCode)).toBe(true);
    // The venue itself may go back to it.
    expect(await m.venues.shortCodeTaken(oldCode, venue.id)).toBe(false);
    await m.venues.deleteVenue(venue.id);
    expect(await m.venues.shortCodeTaken(oldCode)).toBe(true);
    expect(await m.venues.shortCodeTaken(`${oldCode}-new`)).toBe(true);
    expect(await m.venues.findVenue(oldCode)).toBeNull();
  });
});

describe("till races", () => {
  it("two tills redeeming at once only spend the stamps once", async () => {
    const venue = await stampVenue();
    const db = await m.db.getDb();
    const { customer } = await m.customers.upsertCustomer(db, { venueId: venue.id, email: "race@example.com", captureSource: "landing" });
    const card = await m.cards.createCard(db, venue.id, customer.id, 5);
    (await db.run("INSERT INTO staff_devices (id, venue_id, label) VALUES (?, ?, 'Till')", `race_${seq}`, venue.id));
    const device = { id: `race_${seq}`, venueId: venue.id, label: "Till" };
    const results = await Promise.allSettled([m.staff.redeemReward(device, card.id, 0), m.staff.redeemReward(device, card.id, 0)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await m.cards.findCardById(db, card.id))!.stamps).toBe(0);
  });
});

describe("guest page analytics", () => {
  it("stores a batch of events in one beacon, and still takes a single event", async () => {
    const venue = await stampVenue();
    const { POST } = await import("@/app/api/events/route");
    const post = (body: object) =>
      POST(new Request("http://localhost/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), undefined);
    const params = { venue_id: venue.id, session_id: "batch-visit" };
    expect((await post({ events: [{ name: "screen_viewed", params }, { name: "landing_opened", params: { ...params, features_shown: "menu" } }] })).status).toBe(204);
    const single = await post({ name: "menu_viewed", params });
    expect(single.status).toBe(204);
    // Every API answer says where its time went: database time and query count, and the whole request.
    expect(single.headers.get("server-timing")).toMatch(/^db;dur=\d+(\.\d)?;desc="\d+ quer(y|ies)", total;dur=\d+(\.\d)?$/);
    expect((await post({ events: [] })).status).toBe(400);
    const db = await m.db.getDb();
    const rows = await db.all<{ name: string }>("SELECT name FROM events WHERE venue_id = ? ORDER BY id", venue.id);
    expect(rows.map((row) => row.name)).toEqual(["screen_viewed", "landing_opened", "menu_viewed"]);
    // Events for a venue that doesn't exist are dropped, quietly.
    expect((await post({ events: [{ name: "screen_viewed", params: { venue_id: "ven_nope", session_id: "x" } }] })).status).toBe(204);
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM events WHERE venue_id = 'ven_nope'"))!.n).toBe(0);
  });
});

describe("error reports", () => {
  it("leave out tokens in query strings, cookies, headers and request bodies", async () => {
    const { scrubEvent } = await import("./monitoring");
    const event = scrubEvent({
      request: { url: "https://tapmore.app/card/crd_1?t=secret-token", query_string: "t=secret-token", cookies: { tt_session: "x" }, headers: { cookie: "x" }, data: '{"email":"guest@example.com"}' },
    });
    expect(event.request).toEqual({ url: "https://tapmore.app/card/crd_1" });
  });

  it("strip the same from traces: addresses lose their query string, headers go", async () => {
    const { scrubEvent } = await import("./monitoring");
    const event = scrubEvent({
      contexts: {
        trace: { data: { "http.target": "/api/cards/crd_1/state?t=secret-token", "http.request.header.cookie": "tt_session=x", "http.method": "GET" } },
        nextjs: { request_path: "/card/crd_1?t=secret-token" },
      },
      spans: [{ description: "GET /reset-password?token=secret-token", data: { "url.full": "https://tapmore.app/reset-password?token=secret-token", "url.query": "token=secret-token" } }],
    });
    expect(JSON.stringify(event)).not.toContain("secret-token");
    expect(JSON.stringify(event)).not.toContain("tt_session");
    expect(event.contexts?.trace?.data).toEqual({ "http.target": "/api/cards/crd_1/state", "http.method": "GET" });
  });
});

describe("joining from the guest page", () => {
  it("needs the “I agree to join” box ticked", async () => {
    const venue = await stampVenue();
    const { POST } = await import("@/app/api/loyalty/enroll/route");
    const post = (body: object) =>
      POST(new Request("http://localhost/api/loyalty/enroll", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), undefined);
    const refused = await post({ venueId: venue.id, email: "no-agree@example.com", name: "Sam" });
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { error: string }).error).toMatch(/agree/i);
    const joined = await post({ venueId: venue.id, email: "agrees@example.com", name: "Sam", agreed: true });
    expect(joined.status).toBe(200);
    const db = await m.db.getDb();
    expect((await db.get<{ at: string | null }>("SELECT membership_agreed_at AS at FROM customers WHERE email = 'agrees@example.com'"))!.at).toBeTruthy();
  });
});

describe("adding members at the till", () => {
  it("signs a guest up with no consent recorded, and opens an existing member's card instead of a new one", async () => {
    const venue = await stampVenue({ crm: { enabled: true, wifiCapture: false, feedbackCapture: false, birthdayAsk: true } });
    const db = await m.db.getDb();
    (await db.run("INSERT INTO staff_devices (id, venue_id, label) VALUES (?, ?, 'Till')", `enroll_${seq}`, venue.id));
    const device = { id: `enroll_${seq}`, venueId: venue.id, label: "Till" };

    const added = await m.staff.enrollAtTill(device, { name: "Priya Shah", email: " Priya@Example.com ", birthday: { month: 3, day: 14 }, agreed: true }, ORIGIN);
    expect(added.wasExisting).toBe(false);
    const guest = (await db.get<{ email: string; first_name: string; capture_source: string; marketing_consent: string; birthday_month: number }>(
      "SELECT c.email, c.first_name, c.capture_source, c.marketing_consent, c.birthday_month FROM customers c JOIN loyalty_cards l ON l.customer_id = c.id WHERE l.id = ?",
      added.cardId,
    ))!;
    expect(guest).toMatchObject({ email: "priya@example.com", first_name: "Priya", capture_source: "till", marketing_consent: "unasked", birthday_month: 3 });
    // Their card email goes out.
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE recipient = 'priya@example.com'"))!.n).toBe(1);

    // Staff confirmed she agreed: kept as the record of it.
    expect((await db.get<{ at: string | null }>("SELECT membership_agreed_at AS at FROM customers WHERE email = 'priya@example.com'"))!.at).toBeTruthy();
    const { staffEnrollRequest } = await import("@/lib/api/staff-contracts");
    expect(staffEnrollRequest.safeParse({ name: "No Tick", email: "no-tick@example.com" }).success).toBe(false);

    const again = await m.staff.enrollAtTill(device, { name: "Priya", email: "priya@example.com", agreed: true }, ORIGIN);
    expect(again).toEqual({ cardId: added.cardId, wasExisting: true });
    await expect(m.staff.enrollAtTill(device, { name: "X", email: "not-an-email", agreed: true }, ORIGIN)).rejects.toThrow(/email/i);
  });
});

describe("till devices", () => {
  it("opened from a login stop working when that account is blocked or deleted", async () => {
    const venue = await stampVenue();
    const db = await m.db.getDb();
    const staffUser = await m.users.insertUser({ email: `till-user${seq}@example.com`, name: "Till", passwordHash: "x" });
    const digest = (token: string) => createHash("sha256").update(token).digest("base64url");
    await db.run("INSERT INTO staff_devices (id, venue_id, label, user_id) VALUES (?, ?, 'Till', ?), (?, ?, 'Counter', NULL)", digest("login-till"), venue.id, staffUser.id, digest("paired-till"), venue.id);
    const deviceFor = async (token: string) => {
      jar.set("tt_staff", token);
      return await m.staff.currentStaffDevice();
    };
    expect((await deviceFor("login-till"))?.venueId).toBe(venue.id);
    await m.users.setUserBlocked(staffUser.id, true);
    expect(await deviceFor("login-till")).toBeNull();
    // A device the owner paired directly belongs to no login, so it carries on.
    expect((await deviceFor("paired-till"))?.venueId).toBe(venue.id);
    await m.users.setUserBlocked(staffUser.id, false);
    expect((await deviceFor("login-till"))?.venueId).toBe(venue.id);
    await db.run("DELETE FROM users WHERE id = ?", staffUser.id);
    expect(await deviceFor("login-till")).toBeNull();
    jar.clear();
  });
});

describe("rate limits", () => {
  it("count hits from every instance of the app, not just this one", async () => {
    const key = `shared-limit-${Date.now()}`;
    await m.http.rateLimitKey(key, 3);
    // Other instances (each with its own memory) have added two more to the shared counter.
    const db = await m.db.getDb();
    const id = createHash("sha256").update(`60000:${key}`).digest("base64url");
    await db.run("UPDATE rate_limits SET hits = hits + 2 WHERE key = ?", id);
    await expect(m.http.rateLimitKey(key, 3)).rejects.toThrow(/too many/i);
  });

  it("start counting again in the next window", async () => {
    const key = `window-limit-${Date.now()}`;
    await m.http.rateLimitKey(key, 1, 50);
    await new Promise((resolve) => setTimeout(resolve, 120));
    await expect(m.http.rateLimitKey(key, 1, 50)).resolves.toBeUndefined();
  });

  it("check several limits in one write, refusing when any one is over", async () => {
    const minute = `many-minute-${Date.now()}`;
    const day = `many-day-${Date.now()}`;
    const limits = [
      { key: minute, limit: 5 },
      { key: day, limit: 2, windowMs: 24 * 60 * 60_000 },
    ];
    await m.http.rateLimitMany(limits);
    await m.http.rateLimitMany(limits);
    // The daily limit is spent, though the per-minute one isn't.
    await expect(m.http.rateLimitMany(limits)).rejects.toThrow(/too many/i);
    // Both counters went up together, each in its own window; the refused
    // third try was turned away by this instance's own count, before the database.
    const db = await m.db.getDb();
    const hits = async (key: string, windowMs: number) =>
      (await db.get<{ hits: number }>("SELECT hits FROM rate_limits WHERE key = ?", createHash("sha256").update(`${windowMs}:${key}`).digest("base64url")))?.hits;
    expect(await hits(minute, 60_000)).toBe(2);
    expect(await hits(day, 24 * 60 * 60_000)).toBe(2);
    // Another instance pushed the shared daily count over: refused here too, though this instance's own count isn't.
    const other = `many-other-${Date.now()}`;
    await m.http.rateLimitMany([{ key: other, limit: 2, windowMs: 24 * 60 * 60_000 }]);
    await db.run("UPDATE rate_limits SET hits = hits + 5 WHERE key = ?", createHash("sha256").update(`${24 * 60 * 60_000}:${other}`).digest("base64url"));
    await expect(m.http.rateLimitMany([{ key: `${other}-minute`, limit: 50 }, { key: other, limit: 2, windowMs: 24 * 60 * 60_000 }])).rejects.toThrow(/too many/i);
  });
});

describe("housekeeping", () => {
  it("deletes expired sessions and old email copies once a day", async () => {
    const db = await m.db.getDb();
    const user = await m.users.insertUser({ email: "hk@example.com", name: "HK", passwordHash: "x" });
    (await db.run("INSERT INTO sessions (id, user_id, expires_at) VALUES ('old', ?, now() - INTERVAL '1 day'), ('live', ?, now() + INTERVAL '1 day')", user.id, user.id));
    (await db.run("INSERT INTO outbox (recipient, subject, body, created_at) VALUES ('a@b.c', 's', 'b', now() - INTERVAL '100 days')"));
    const day = new Date("2031-01-01T00:00:00Z");
    expect(await m.housekeeping.runHousekeeping(day)).toBeGreaterThanOrEqual(2);
    expect(await m.housekeeping.runHousekeeping(day)).toBe(0);
    const left = await db.all<{ id: string }>("SELECT id FROM sessions WHERE user_id = ?", user.id);
    expect(left.map((row) => row.id)).toEqual(["live"]);
  });
});

describe("demo venues", () => {
  it("stay live for anyone to try, but never count as real venues in the admin console", async () => {
    const { DEMO_VENUE_IDS } = await import("./seed");
    const admin = await import("./admin");
    expect((await m.venues.findVenue("demo"))?.id).toBe("ven_juniper");
    const listed = (await m.venues.listVenuesForAdmin()).map((venue) => venue.id);
    expect(listed.some((id) => DEMO_VENUE_IDS.includes(id))).toBe(false);
    const db = await m.db.getDb();
    const all = (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM venues"))!.n;
    expect((await admin.platformCounts()).venues).toBe(all - DEMO_VENUE_IDS.length);
  });
});

describe("admin venue powers", () => {
  it("cancels a venue's renewal and deletes a venue for its owner, logging both", async () => {
    const operator = await import("./services/operator");
    const subs = await import("./repositories/subscriptions");
    const admin = await m.users.insertUser({ email: "ops@example.com", name: "Ops", passwordHash: "x" });
    const venue = await stampVenue();
    await subs.updateSubscription(venue.id, { paid: true, status: "active", provider: "dev", currentPeriodEnd: new Date(Date.now() + 86_400_000 * 300).toISOString() });

    await operator.updateVenueAsAdmin(admin, venue.id, { cancelRenewal: true });
    // Dev billing ends straight away, like the owner's own Cancel does locally.
    expect((await subs.getSubscription(venue.id))?.paid).toBe(false);

    await expect(operator.deleteVenueAsAdmin(admin, venue.id, "Wrong name")).rejects.toThrow(/exactly/);
    await expect(operator.deleteVenueAsAdmin(admin, "ven_juniper", "Juniper Coffee House")).rejects.toThrow(/Demo venues/);
    await operator.deleteVenueAsAdmin(admin, venue.id, venue.config.name);
    expect(await m.venues.getVenueRecord(venue.id)).toBeNull();

    const db = await m.db.getDb();
    const logged = await db.all<{ action: string }>("SELECT action FROM admin_actions WHERE target_id = ? ORDER BY created_at", venue.id);
    expect(logged.map((row) => row.action)).toEqual(["Cancelled subscription renewal", "Deleted venue"]);
  });
});

describe("feedback summary", () => {
  it("waits for 3 notes, and reuses a saved summary until new feedback arrives", async () => {
    const { feedbackSummary } = await import("./services/feedback-summary");
    const venue = await stampVenue();
    const named = { id: venue.id, name: venue.config.name };
    await m.feedback.submitFeedback({ venueId: venue.id, text: "Lovely chai" });
    expect(await feedbackSummary(named)).toEqual({ state: "too_few", notes: 1 });
    await m.feedback.submitFeedback({ venueId: venue.id, text: "Service was slow" });
    await m.feedback.submitFeedback({ venueId: venue.id, text: "Great samosas" });

    // A summary saved for exactly these notes is shown without calling the AI.
    const db = await m.db.getDb();
    const rows = await db.all<{ id: string }>("SELECT id FROM feedback WHERE venue_id = ? ORDER BY created_at DESC", venue.id);
    const summary = { headline: "Mostly happy guests", praise: ["Chai"], problems: ["Slow service"], suggestion: "" };
    await db.run("INSERT INTO feedback_summaries (venue_id, fingerprint, summary) VALUES (?, ?, ?)", venue.id, `3:${rows[0].id}:${rows[2].id}`, JSON.stringify(summary));
    const ready = await feedbackSummary(named);
    expect(ready.state).toBe("ready");
    expect(ready.state === "ready" && ready.summary).toEqual(summary);
  });
});

describe("scan sources", () => {
  it("count a table's QR scans and NFC taps as one spot", async () => {
    const { venueStats } = await import("./repositories/insights");
    const venue = await stampVenue();
    const db = await m.db.getDb();
    const open = (source: string | null, session: string) =>
      db.run("INSERT INTO events (name, params, venue_id) VALUES ('landing_opened', ?, ?)", JSON.stringify({ ...(source ? { source } : {}), session_id: session }), venue.id);
    await open("table-4", "a");
    await open("table-4", "b");
    await open("table-4-nfc", "c");
    await open(null, "d");
    await open("nfc", "e");
    const { sources } = await venueStats(venue.id, 7);
    expect(sources).toContainEqual({ source: "table-4", scans: 3 });
    expect(sources).toContainEqual({ source: "unknown", scans: 2 });
    expect(sources.some((row) => row.source.endsWith("nfc"))).toBe(false);
  });
});

describe("scan counting", () => {
  it("counts guests only, once per visit, in the venue's own days, the same in the admin console", async () => {
    const { venueStats, windowStart } = await import("./repositories/insights");
    const venue = await stampVenue();
    const db = await m.db.getDb();
    const open = (params: Record<string, unknown>) =>
      db.run("INSERT INTO events (name, params, venue_id) VALUES ('landing_opened', ?, ?)", JSON.stringify(params), venue.id);
    await open({ session_id: "guest-1", source: "table-1" });
    await open({ session_id: "guest-1", source: "table-1" }); // a refresh: same visit
    await open({ session_id: "guest-2", source: "table-2" });
    await open({ session_id: "owner", source: "table-1", team: 1 }); // the owner testing their own code
    await open({ session_id: "editor", source: "preview" });
    const stats = await venueStats(venue.id, 7, 330);
    expect(stats.scans).toBe(2);
    expect(stats.daily.reduce((sum, day) => sum + day.scans, 0)).toBe(2);
    const listed = (await m.venues.listVenuesForAdmin()).find((row) => row.id === venue.id)!;
    expect(listed.scans7d).toBe(2);

    // "Last 7 days" in India starts at local midnight six days ago: 11 Oct 01:30 IST → 5 Oct 00:00 IST (4 Oct 18:30 UTC).
    expect(windowStart(7, 330, Date.parse("2026-10-10T20:00:00Z"))).toBe("2026-10-04T18:30:00.000Z");
  });
});

describe("small pieces", () => {
  it("blanks private links in stored email copies", () => {
    expect(m.mailer.redactLinks("Reset: https://x.app/reset-password?token=abc123\nCard: https://x.app/card/crd_1?t=zzz&s=1")).toBe(
      "Reset: https://x.app/reset-password?token=[redacted]\nCard: https://x.app/card/crd_1?t=[redacted]&s=1",
    );
  });

  it("reads the client address from the proxy's end of X-Forwarded-For", () => {
    const request = (xff: string) => new Request("https://x.app/", { headers: { "x-forwarded-for": xff } });
    expect(m.http.clientIp(request("1.1.1.1"))).toBe("1.1.1.1");
    // A client can't pick its own address by sending the header: the proxy's entry wins.
    expect(m.http.clientIp(request("6.6.6.6, 2.2.2.2"))).toBe("2.2.2.2");
    process.env.TRUSTED_PROXY_COUNT = "2";
    expect(m.http.clientIp(request("6.6.6.6, 3.3.3.3, 4.4.4.4"))).toBe("3.3.3.3");
    delete process.env.TRUSTED_PROXY_COUNT;
  });

  it("asks Indian guests to confirm they're 18 before agreeing to offers", async () => {
    const venue = (await m.venues.findVenue((await stampVenue()).id))!;
    expect(m.features.consentAgeThreshold(venue)).toBe(18);
    expect(m.features.consentAgeThreshold({ ...venue, currencyCode: "GBP" })).toBe(13);
  });

  it("changes one setting without resetting the others in its section", () => {
    const current = m.settings.DEFAULT_SETTINGS;
    const patched = m.settings.venueSettingsSchema.parse(m.settings.applySettingsPatch({ ...current, stampPolicy: { cooldownMinutes: 60, feedbackStamp: false } }, { stampPolicy: { cooldownMinutes: 15 } }));
    expect(patched.stampPolicy).toEqual({ cooldownMinutes: 15, feedbackStamp: false });
  });
});
