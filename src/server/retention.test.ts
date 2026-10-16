import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { liveAnnouncement } from "@/lib/venue/features";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tapmore-retention-"));
process.env.DATA_DIR = dataDir;
delete process.env.ANTHROPIC_API_KEY;

type M = {
  db: typeof import("./db");
  users: typeof import("./repositories/users");
  admin: typeof import("./services/venue-admin");
  schema: typeof import("@/lib/venue/schema");
  contracts: typeof import("@/lib/api/contracts");
  loyalty: typeof import("./services/loyalty");
  staff: typeof import("./services/staff");
  cards: typeof import("./repositories/loyalty-cards");
  retention: typeof import("./repositories/retention");
  venues: typeof import("./repositories/venues");
  guestEmails: typeof import("./jobs/guest-emails");
  ai: typeof import("./services/ai");
};
let m: M;

beforeAll(async () => {
  m = {
    db: await import("./db"),
    users: await import("./repositories/users"),
    admin: await import("./services/venue-admin"),
    schema: await import("@/lib/venue/schema"),
    contracts: await import("@/lib/api/contracts"),
    loyalty: await import("./services/loyalty"),
    staff: await import("./services/staff"),
    cards: await import("./repositories/loyalty-cards"),
    retention: await import("./repositories/retention"),
    venues: await import("./repositories/venues"),
    guestEmails: await import("./jobs/guest-emails"),
    ai: await import("./services/ai"),
  };
});

afterAll(async () => {
  await m.db.closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

let seq = 0;
/** Pro-trial venue with a 6-stamp card, referrals on (2 for the inviter, 1 for the friend), and a till device. */
async function setup() {
  seq += 1;
  const owner = await m.users.insertUser({ email: `o${seq}@example.com`, name: "Owner", passwordHash: "x" });
  const record = await m.admin.createVenueForUser(owner, m.schema.createVenueRequest.parse({ name: `Ref Cafe ${seq}`, venueType: "cafe", currencyCode: "GBP" }));
  await m.admin.updateVenue(record, {
    config: {
      loyaltyProgram: { rewardName: "Free coffee", stampsRequired: 6, referral: { enabled: true, referrerStamps: 2, friendStamps: 1 } },
      crm: { enabled: true, wifiCapture: false, feedbackCapture: false, birthdayAsk: true },
    },
  });
  const device = { id: `dev_r${seq}`, venueId: record.id, label: "Till" };
  (await (await m.db.getDb()).run("INSERT INTO staff_devices (id, venue_id, label) VALUES (?, ?, 'Till')", device.id, record.id));
  return { venueId: record.id, device };
}

async function join(venueId: string, email: string, ref?: string) {
  return await m.loyalty.enroll(m.contracts.enrollRequest.parse({ venueId, email, firstName: "Sam", captureSource: "landing", ref, agreed: true }), "http://localhost:3000");
}

const outboxCount = async (subjectLike: string) =>
  ((await (await m.db.getDb()).get("SELECT COUNT(*) AS n FROM outbox WHERE subject LIKE ?", `%${subjectLike}%`)) as { n: number }).n;

describe("menu schema additions", () => {
  it("accepts explainers, badges and specials, and caps their size", async () => {
    const item = { id: "i1", name: "Shakshuka", priceInPence: 950, isAvailable: true, allergens: [], dietaryTags: [] };
    expect(m.schema.menuItemSchema.safeParse({ ...item, explainer: "Eggs poached in spiced tomato.", badges: ["chef"], featured: true }).success).toBe(true);
    expect(m.schema.menuItemSchema.safeParse({ ...item, explainer: "x".repeat(601) }).success).toBe(false);
    expect(m.schema.menuItemSchema.safeParse({ ...item, badges: ["cheap"] }).success).toBe(false);
  });

  it("hides an announcement after its last day", async () => {
    expect(liveAnnouncement({ text: "Pumpkin latte!", until: "2026-10-10" }, "2026-10-10")?.text).toBe("Pumpkin latte!");
    expect(liveAnnouncement({ text: "Pumpkin latte!", until: "2026-10-10" }, "2026-10-11")).toBeNull();
    expect(liveAnnouncement({ text: "  ", until: null }, "2026-10-11")).toBeNull();
    expect(liveAnnouncement({ text: "Always on" }, "2030-01-01")?.text).toBe("Always on");
  });
});

describe("AI guard rails", () => {
  it("refuses cleanly when no API key is configured", async () => {
    expect(m.ai.aiConfigured()).toBe(false);
    await expect(m.ai.explainDishes({ id: "v", name: "Cafe" }, [{ id: "a", name: "Shakshuka" }], false)).rejects.toThrow(/isn't set up/);
  });
});

describe("refer a friend", () => {
  it("gives the friend welcome stamps and the inviter stamps only after the friend's first staff stamp", async () => {
    const { venueId, device } = await setup();
    const inviter = await join(venueId, "inviter@example.com");
    const code = await m.retention.ensureReferralCode(inviter.cardId);
    expect(await m.retention.ensureReferralCode(inviter.cardId)).toBe(code);

    const friend = await join(venueId, "friend@example.com", code);
    const db = await m.db.getDb();
    expect((await m.cards.findCardById(db, friend.cardId))?.stamps).toBe(1);
    expect((await m.cards.findCardById(db, inviter.cardId))?.stamps).toBe(0);

    await m.staff.stampCard(device, friend.cardId, 1, false);
    expect((await m.cards.findCardById(db, inviter.cardId))?.stamps).toBe(2);
    // Later stamps don't pay out again.
    await m.staff.stampCard(device, friend.cardId, 1, true);
    expect((await m.cards.findCardById(db, inviter.cardId))?.stamps).toBe(2);
  });

  it("ignores self-referral, unknown codes and caps rewards at five a month", async () => {
    const { venueId, device } = await setup();
    const inviter = await join(venueId, "cap@example.com");
    const code = await m.retention.ensureReferralCode(inviter.cardId);
    // Re-joining with your own email can't refer yourself.
    await join(venueId, "cap@example.com", code);
    expect((await join(venueId, "nobody@example.com", "zzzzzzzz")).cardId).toBeTruthy();

    for (let i = 0; i < 7; i++) {
      const friend = await join(venueId, `f${i}@example.com`, code);
      await m.staff.stampCard(device, friend.cardId, 1, false);
    }
    // 5 rewards × 2 stamps, capped by the 6-stamp goal.
    const events = (await (await m.db.getDb()).get("SELECT COUNT(*) AS n FROM stamp_events WHERE card_id = ? AND kind = 'referral'", inviter.cardId)) as { n: number };
    expect(events.n).toBe(3);
    expect((await m.cards.findCardById(await m.db.getDb(), inviter.cardId))?.stamps).toBe(6);
  });
});

describe("automatic guest emails", () => {
  it("emails once when a stamp unlocks the reward", async () => {
    const { venueId, device } = await setup();
    const subject = `Free coffee is ready at ${(await m.venues.getVenueRecord(venueId))!.config.name}`;
    const guest = await join(venueId, "ready@example.com");
    await m.staff.stampCard(device, guest.cardId, 5, false);
    expect(await outboxCount(subject)).toBe(0);
    await m.staff.stampCard(device, guest.cardId, 1, true);
    expect(await outboxCount(subject)).toBe(1);
    // Redeem and re-reach the goal the same day: no second email.
    await m.staff.redeemReward(device, guest.cardId, 0);
    await m.staff.stampCard(device, guest.cardId, 5, true);
    await m.staff.stampCard(device, guest.cardId, 1, true);
    expect(await outboxCount(subject)).toBe(1);
  });

  it("sends the birthday wish to every card member with a birthday, once, in daytime", async () => {
    const { venueId } = await setup();
    const venue = (await m.venues.getVenueRecord(venueId))!;
    const db = await m.db.getDb();
    await m.venues.saveVenueSettings(venueId, {
      ...(await m.venues.getVenueSettings(venueId)),
      automations: { birthday: { enabled: true, offer: "Free cake" } },
    });
    const first = await join(venueId, "yes@example.com");
    const second = await join(venueId, "no@example.com");
    (await db.run("UPDATE customers SET birthday_month = 10, birthday_day = 5 WHERE id IN (?, ?)", first.customerId, second.customerId));

    // 5 Oct 2026, 10:00 London: today's birthdays get their wish (it's part of the membership).
    const morning = new Date("2026-10-05T09:00:00Z");
    await m.guestEmails.runGuestAutomations(new Date("2026-10-05T05:00:00Z"));
    expect(await outboxCount(`birthday from ${venue.config.name}`)).toBe(0);
    await m.guestEmails.runGuestAutomations(morning);
    await m.guestEmails.runGuestAutomations(morning);
    expect(await outboxCount(`birthday from ${venue.config.name}`)).toBe(2);

    const mail = (await db.get("SELECT body FROM outbox WHERE subject LIKE ? AND recipient = 'yes@example.com'", `%birthday from ${venue.config.name}%`)) as { body: string };
    // A wish that invites them in, without giving the reward away.
    expect(mail.body).toContain("Happy birthday from everyone at");
    expect(mail.body).toContain("for your birthday reward");
    expect(mail.body).not.toContain("Free cake");
    expect(mail.body).toMatch(/\/unsubscribe\?token=/);
  });

  it("skip members who never agreed to the membership's emails (joined before the box existed)", async () => {
    const { venueId } = await setup();
    await m.venues.saveVenueSettings(venueId, {
      ...(await m.venues.getVenueSettings(venueId)),
      automations: { birthday: { enabled: true, offer: "Free cake" } },
    });
    const legacy = await m.loyalty.enroll({ venueId, email: `legacy${seq}@example.com`, firstName: "Old" }, "http://localhost:3000");
    const db = await m.db.getDb();
    await db.run("UPDATE customers SET birthday_month = 10, birthday_day = 5 WHERE id = ?", legacy.customerId);
    await m.guestEmails.runGuestAutomations(new Date("2026-10-05T09:00:00Z"));
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE recipient = ? AND subject LIKE '%birthday%'", `legacy${seq}@example.com`))!.n).toBe(0);
  });

  it("go only to card members", async () => {
    const customers = await import("./repositories/customers");
    const { venueId } = await setup();
    const db = await m.db.getDb();
    await m.venues.saveVenueSettings(venueId, {
      ...(await m.venues.getVenueSettings(venueId)),
      automations: { birthday: { enabled: true, offer: "Free cake" } },
    });
    const member = await join(venueId, `member${seq}@example.com`);
    // Gave an email for the Wi-Fi only: no card.
    const { customer: wifiOnly } = await customers.upsertCustomer(db, { venueId, email: `wifi-only${seq}@example.com`, captureSource: "wifi" });
    await db.run("UPDATE customers SET birthday_month = 10, birthday_day = 5 WHERE id IN (?, ?)", member.customerId, wifiOnly.id);

    await m.guestEmails.runGuestAutomations(new Date("2026-10-05T09:00:00Z"));
    const name = (await m.venues.getVenueRecord(venueId))!.config.name;
    const sentTo = ((await db.all("SELECT recipient FROM outbox WHERE subject LIKE ?", `%birthday from ${name}%`)) as { recipient: string }[]).map((row) => row.recipient);
    expect(sentTo).toEqual([`member${seq}@example.com`]);
  });

  it("unsubscribing stops the birthday emails, and the card keeps working", async () => {
    const { venueId } = await setup();
    await m.venues.saveVenueSettings(venueId, {
      ...(await m.venues.getVenueSettings(venueId)),
      automations: { birthday: { enabled: true, offer: "Free cake" } },
    });
    const guest = await join(venueId, `bye${seq}@example.com`);
    const db = await m.db.getDb();
    await db.run("UPDATE customers SET birthday_month = 10, birthday_day = 5 WHERE id = ?", guest.customerId);
    const token = await m.retention.ensureUnsubscribeToken(guest.customerId!);
    const found = (await m.retention.findByUnsubscribeToken(token))!;
    expect(found.unsubscribed).toBe(false);
    await m.retention.unsubscribe(found.customerId);
    expect((await m.retention.findByUnsubscribeToken(token))?.unsubscribed).toBe(true);
    await m.guestEmails.runGuestAutomations(new Date("2026-10-05T09:00:00Z"));
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE recipient = ? AND subject LIKE '%birthday%'", `bye${seq}@example.com`))!.n).toBe(0);
    expect(await m.cards.findCardById(db, guest.cardId)).not.toBeNull();
});
});
