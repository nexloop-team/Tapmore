import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// db.ts reads DATA_DIR on load, so point it at a scratch directory first.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tapmore-staff-"));
process.env.DATA_DIR = dataDir;

type M = {
  db: typeof import("./db");
  users: typeof import("./repositories/users");
  admin: typeof import("./services/venue-admin");
  schema: typeof import("@/lib/venue/schema");
  staff: typeof import("./services/staff");
  cards: typeof import("./repositories/loyalty-cards");
  customers: typeof import("./repositories/customers");
  venues: typeof import("./repositories/venues");
  insights: typeof import("./repositories/insights");
};
let m: M;

beforeAll(async () => {
  m = {
    db: await import("./db"),
    users: await import("./repositories/users"),
    admin: await import("./services/venue-admin"),
    schema: await import("@/lib/venue/schema"),
    staff: await import("./services/staff"),
    cards: await import("./repositories/loyalty-cards"),
    customers: await import("./repositories/customers"),
    venues: await import("./repositories/venues"),
    insights: await import("./repositories/insights"),
  };
});

afterAll(async () => {
  await m.db.closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

let seq = 0;
/** A venue on its Pro trial with a 5-stamp card (free pastry at 3), one member, and a paired device. */
async function setup() {
  seq += 1;
  const owner = await m.users.insertUser({ email: `owner${seq}@example.com`, name: "Owner", passwordHash: "x" });
  const venue = await m.admin.createVenueForUser(owner, m.schema.createVenueRequest.parse({ name: `Stamp Cafe ${seq}`, venueType: "cafe", currencyCode: "GBP" }));
  await m.admin.updateVenue(venue, {
    config: {
      loyaltyProgram: {
        rewardName: "Free coffee",
        stampsRequired: 5,
        rewardTiers: [
          { rewardName: "Free pastry", stampsRequired: 3 },
          { rewardName: "Free coffee", stampsRequired: 5 },
        ],
      },
    },
  });
  const db = await m.db.getDb();
  const { customer } = await m.customers.upsertCustomer(db, { venueId: venue.id, email: `guest${seq}@example.com`, firstName: "Gus", captureSource: "landing" });
  const card = await m.cards.createCard(db, venue.id, customer.id, 0);
  (await db.run("INSERT INTO staff_devices (id, venue_id, label) VALUES (?, ?, 'Till')", `dev_${seq}`, venue.id));
  return { venue, card, device: { id: `dev_${seq}`, venueId: venue.id, label: "Till" } };
}

describe("staff stamping", () => {
  it("stamps, enforces the cooldown unless confirmed, and caps at the top reward", async () => {
    const { card, device } = await setup();
    expect((await m.staff.stampCard(device, card.id, 1, false)).stamps).toBe(1);
    await expect(m.staff.stampCard(device, card.id, 1, false)).rejects.toThrow(/stamped/);
    expect((await m.staff.stampCard(device, card.id, 2, true)).stamps).toBe(3);
    // Asking for 5 more only fills the card to the top reward.
    const full = await m.staff.stampCard(device, card.id, 5, true);
    expect(full.stamps).toBe(5);
    expect(full.tiers.every((tier) => tier.unlocked)).toBe(true);
    await expect(m.staff.stampCard(device, card.id, 1, true)).rejects.toThrow(/full/);
  });

  it("redeems a tier by spending its stamps, and undo puts them back", async () => {
    const { card, device } = await setup();
    await m.staff.stampCard(device, card.id, 4, false);
    await expect(m.staff.redeemReward(device, card.id, 1)).rejects.toThrow(/Not enough/);
    const redeemed = await m.staff.redeemReward(device, card.id, 0);
    expect(redeemed.stamps).toBe(1);
    expect(redeemed.undoable).toMatchObject({ kind: "redeem", rewardName: "Free pastry" });
    const undone = await m.staff.undoLast(device, card.id);
    expect(undone.stamps).toBe(4);
    // The stamp before it is still undoable, then there's nothing left.
    expect((await m.staff.undoLast(device, card.id)).stamps).toBe(0);
    await expect(m.staff.undoLast(device, card.id)).rejects.toThrow(/Nothing to undo/);
  });

  it("only works on cards from the device's own venue", async () => {
    const a = await setup();
    const b = await setup();
    await expect(m.staff.stampCard(a.device, b.card.id, 1, false)).rejects.toThrow(/couldn't find/);
  });

  it("stops when the venue's plan no longer includes loyalty", async () => {
    const { venue, card, device } = await setup();
    (await (await m.db.getDb()).run("UPDATE subscriptions SET trial_ends_at = ? WHERE venue_id = ?", new Date(Date.now() - 1000).toISOString(), venue.id));
    await expect(m.staff.stampCard(device, card.id, 1, false)).rejects.toThrow(/no active stamp card/);
  });

  it("finds members by name or email, masking the address", async () => {
    const { device, card } = await setup();
    const [match] = await m.staff.searchMembers(device, "gus");
    expect(match.cardId).toBe(card.id);
    expect(match.email).toMatch(/•••/);
    expect(await m.staff.searchMembers(device, "g")).toEqual([]);
  });

  it("revoked devices disappear from the owner's list", async () => {
    const { venue, device } = await setup();
    expect((await m.staff.listStaffDevices(venue.id)).map((d) => d.id)).toContain(device.id);
    await m.staff.revokeStaffDevice(venue.id, device.id);
    expect(await m.staff.listStaffDevices(venue.id)).toEqual([]);
    await expect(m.staff.revokeStaffDevice(venue.id, device.id)).rejects.toThrow(/not found/);
  });

  it("counts stamps given and rewards redeemed in the venue stats", async () => {
    const { venue, card, device } = await setup();
    await m.staff.stampCard(device, card.id, 3, false);
    await m.staff.redeemReward(device, card.id, 0);
    const stats = await m.insights.venueStats(venue.id, 7);
    expect(stats.stampsGiven).toBe(3);
    expect(stats.rewardsRedeemed).toBe(1);
  });
});

describe("live card check", () => {
  it("moves its marker with every stamp and undo, and refuses a wrong token", async () => {
    const { card, device } = await setup();
    const start = await m.cards.findCardState(card.id, card.access_token);
    expect(start?.stamps).toBe(0);
    await m.staff.stampCard(device, card.id, 1, false);
    const stamped = await m.cards.findCardState(card.id, card.access_token);
    expect(stamped?.stamps).toBe(1);
    expect(stamped?.version).not.toBe(start?.version);
    await m.staff.undoLast(device, card.id);
    const undone = await m.cards.findCardState(card.id, card.access_token);
    expect(undone?.stamps).toBe(0);
    // Back to 0 stamps, but the card did change: the marker differs from the start.
    expect(undone?.version).not.toBe(start?.version);
    expect(await m.cards.findCardState(card.id, "wrong")).toBeNull();
  });

  it("checks quickly at first, then slower, then stops", async () => {
    const { nextCheckDelay } = await import("@/components/card/useCardChanges");
    expect(nextCheckDelay(0)).toBe(4_000);
    expect(nextCheckDelay(3 * 60_000)).toBe(15_000);
    expect(nextCheckDelay(7 * 60_000)).toBe(30_000);
    expect(nextCheckDelay(11 * 60_000)).toBeNull();
  });
});

describe("guest venue lookup", () => {
  it("is live on the trial or a paid plan, and paused otherwise", async () => {
    const { venue } = await setup();
    const db = await m.db.getDb();
    expect((await m.venues.findVenue(venue.shortCode))?.id).toBe(venue.id);
    expect(await m.venues.findPausedVenue(venue.shortCode)).toBeNull();

    // Trial over, nothing paid: the page goes offline but the "Back soon" page knows the venue.
    (await db.run("UPDATE subscriptions SET trial_ends_at = now() - INTERVAL '1 day' WHERE venue_id = ?", venue.id));
    expect(await m.venues.findVenue(venue.shortCode)).toBeNull();
    expect((await m.venues.findPausedVenue(venue.shortCode))?.name).toBe(venue.config.name);

    // Paid: live again, by id or code.
    (await db.run("UPDATE subscriptions SET plan = 'pro', status = 'active', current_period_end = now() + INTERVAL '30 days' WHERE venue_id = ?", venue.id));
    expect((await m.venues.findVenue(venue.id))?.shortCode).toBe(venue.shortCode);

    // Suspended beats paid.
    await m.venues.setVenueStatus(venue.id, "suspended");
    expect(await m.venues.findVenue(venue.shortCode)).toBeNull();
    expect(await m.venues.findPausedVenue(venue.shortCode)).not.toBeNull();

    // No subscription row at all counts as unpaid.
    await m.venues.setVenueStatus(venue.id, "active");
    (await db.run("DELETE FROM subscriptions WHERE venue_id = ?", venue.id));
    expect(await m.venues.findVenue(venue.shortCode)).toBeNull();
  });
});

describe("till resends", () => {
  it("apply a stamp, undo or redeem once however often the same request arrives", async () => {
    const { card, device } = await setup();
    expect((await m.staff.stampCard(device, card.id, 2, false, "req-stamp-0001")).stamps).toBe(2);
    // Queued offline, then sent again when the connection came back: still 2, and no cooldown refusal.
    expect((await m.staff.stampCard(device, card.id, 2, false, "req-stamp-0001")).stamps).toBe(2);
    expect((await m.staff.undoLast(device, card.id, "req-undo-0001")).stamps).toBe(0);
    expect((await m.staff.undoLast(device, card.id, "req-undo-0001")).stamps).toBe(0);
    expect((await m.staff.stampCard(device, card.id, 3, true, "req-stamp-0002")).stamps).toBe(3);
    expect((await m.staff.redeemReward(device, card.id, 0, "req-redeem-001")).stamps).toBe(0);
    expect((await m.staff.redeemReward(device, card.id, 0, "req-redeem-001")).stamps).toBe(0);
    // A new request id is a new action.
    expect((await m.staff.stampCard(device, card.id, 1, true, "req-stamp-0003")).stamps).toBe(1);
  });
});
