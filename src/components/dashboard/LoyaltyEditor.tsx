"use client";

import { Ban, Crown, Plus, Stamp, Trash2, UserPlus, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { useLivePreview } from "@/lib/live-preview";
import { businessProfile, capitalise, lower, personWord } from "@/lib/venue/business";
import { DEFAULT_REFERRAL_OFFERS } from "@/lib/venue/loyalty";
import type { VenueConfig } from "@/lib/venue/schema";
import type { VenueSettings } from "@/lib/venue/settings";
import { BirthdayRewardForm, birthdayRewardMissing } from "./BirthdayRewardForm";
import { FeedbackStampSetting } from "./FeedbackStampSetting";
import { EditorPanel, EditorTabs, PreviewPane, useEditorTab, type EditorTab } from "./EditorFrame";
import { MobilePreview } from "./MobilePreview";
import { Card, Field, SaveBar, SwitchRow, TextField } from "./ui";
import { useToast } from "./toast";
import { useVenueDraft } from "./useVenueDraft";

type Draft = Pick<VenueConfig, "loyaltyProgram" | "crm">;
type Program = NonNullable<VenueConfig["loyaltyProgram"]>;
type Tier = NonNullable<Program["rewardTiers"]>[number];

type Mode = "off" | "stamps" | "referral" | "membership";

const MODES: { value: Mode; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "stamps", label: "Stamp card", hint: "Collect stamps, earn rewards", icon: Stamp },
  { value: "referral", label: "Refer a friend", hint: "An offer for each friend they bring, no stamps", icon: UserPlus },
  { value: "membership", label: "Members club", hint: "A members list for offers, no stamps", icon: Crown },
  { value: "off", label: "Off", hint: "No loyalty card on your page", icon: Ban },
];

function modeOf(program: VenueConfig["loyaltyProgram"]): Mode {
  if (!program) return "off";
  if (program.stampsEnabled !== false) return "stamps";
  return program.referralOffers ? "referral" : "membership";
}

/** Tiers are stored as the full ladder; the editor shows the main reward plus the ones before it. */
function earlierTiers(program: Program | null | undefined): Tier[] {
  const tiers = program?.rewardTiers ?? [];
  return tiers.length > 1 ? tiers.slice(0, -1) : [];
}

function compose(main: { rewardName: string; stampsRequired: number; stampRule?: string | null }, earlier: Tier[], referral: Program["referral"]): Program {
  const sorted = [...earlier].sort((a, b) => a.stampsRequired - b.stampsRequired);
  const { stampRule, ...reward } = main;
  return { ...reward, ...(stampRule ? { stampRule } : {}), stampsEnabled: true, rewardTiers: sorted.length ? [...sorted, reward] : undefined, referral };
}

const DEFAULT_REFERRAL = { enabled: false, referrerStamps: 2, friendStamps: 1 };

export function LoyaltyEditor({
  venueId,
  venueType,
  initial,
  referralStats,
  previewUrl,
  automations,
  feedbackStamp,
  till,
}: {
  venueId: string;
  /** "cafe", "clinic"…: example rewards and words follow it. */
  venueType?: string | null;
  initial: Draft;
  referralStats?: { joined: number; visited: number };
  /** The guest page in preview mode, which shows this editor's draft. */
  previewUrl: string;
  automations: VenueSettings["automations"];
  /** Whether a member's first feedback earns a stamp (stamp cards only). */
  feedbackStamp: boolean;
  /** Staff devices and logins, rendered by the page. */
  till: ReactNode;
}) {
  // Compiled by the React Compiler (annotation mode, see next.config): re-renders only what an edit touches.
  "use memo";
  // The birthday reward lives in the venue's settings, not its page: saved alongside, from the same save bar.
  const [savedBirthday, setSavedBirthday] = useState(automations.birthday);
  const [birthday, setBirthday] = useState(automations.birthday);
  const [birthdaySaving, setBirthdaySaving] = useState(false);
  const [birthdayError, setBirthdayError] = useState<string | null>(null);
  const birthdayDirty = birthday.enabled !== savedBirthday.enabled || birthday.offer !== savedBirthday.offer;
  const editor = useVenueDraft<Draft>(venueId, initial, { pending: birthdayDirty });
  const { draft, update } = editor;
  const router = useRouter();
  const toast = useToast();
  const program = draft.loyaltyProgram ?? null;
  const mode = modeOf(program);
  const earlier = earlierTiers(program);
  const profile = businessProfile(venueType);
  const main = { rewardName: program?.rewardName ?? "", stampsRequired: program?.stampsRequired || 9, stampRule: program?.stampRule ?? null };
  const crm = draft.crm;
  const setCrm = (patch: Partial<Draft["crm"]>) => update("crm", { ...crm, ...patch });

  async function saveBirthday() {
    if (birthdayRewardMissing(birthday, crm.enabled && crm.birthdayAsk)) {
      setBirthdayError("Write what members get on their birthday, or turn the birthday reward off.");
      return;
    }
    setBirthdaySaving(true);
    setBirthdayError(null);
    try {
      const result = await dashboardApi.updateSettings(venueId, { automations: { birthday } });
      setSavedBirthday(result.automations.birthday);
      setBirthday(result.automations.birthday);
      // The page's own save says so when both changed; alone, the birthday reward says it here.
      if (!editor.dirty) toast({ text: "Birthday reward saved." });
      router.refresh();
    } catch (err) {
      setBirthdayError(errorMessage(err));
    } finally {
      setBirthdaySaving(false);
    }
  }

  async function saveAll() {
    await Promise.all([editor.dirty ? editor.save() : null, birthdayDirty ? saveBirthday() : null]);
  }

  function setMode(next: Mode) {
    if (next === "off") update("loyaltyProgram", null);
    else if (next === "membership") update("loyaltyProgram", { rewardName: "", stampsRequired: 0, stampsEnabled: false });
    else if (next === "referral") update("loyaltyProgram", { rewardName: "", stampsRequired: 0, stampsEnabled: false, referralOffers: program?.referralOffers ?? DEFAULT_REFERRAL_OFFERS });
    else
      update(
        "loyaltyProgram",
        compose({ rewardName: main.rewardName || profile.defaultReward, stampsRequired: main.stampsRequired, stampRule: main.stampRule ?? (profile.stampRule || null) }, earlier, program?.referral),
      );
  }

  const referral = program?.referral ?? DEFAULT_REFERRAL;
  const setMain = (patch: Partial<typeof main>) => update("loyaltyProgram", compose({ ...main, ...patch }, earlier, program?.referral));
  const setEarlier = (tiers: Tier[]) => update("loyaltyProgram", compose(main, tiers, program?.referral));
  const setReferral = (patch: Partial<typeof referral>) => update("loyaltyProgram", compose(main, earlier, { ...referral, ...patch }));
  const offers = program?.referralOffers ?? DEFAULT_REFERRAL_OFFERS;
  const setOffers = (patch: Partial<typeof offers>) => update("loyaltyProgram", { rewardName: "", stampsRequired: 0, stampsEnabled: false, referralOffers: { ...offers, ...patch } });

  // The business's own words: "Guests" for a café, "Customers" for a shop.
  const People = capitalise(profile.people);
  const tabs: EditorTab[] = [
    { id: "programme", label: "Programme" },
    { id: "capture", label: `${People}' details` },
    // The till stamps, redeems and gives refer-a-friend offers; a members club has no card code to scan.
    ...(mode === "stamps" || mode === "referral" ? [{ id: "till", label: "Till", anchors: ["staff", "devices"] }] : []),
  ];
  const [tab, setTab] = useEditorTab(tabs);
  useLivePreview(draft);

  return (
    <div className={`editor-grid${mode === "off" ? " editor-grid-solo" : ""}`}>
      <div>
        {mode !== "off" && <MobilePreview src={previewUrl} label="Preview your page" dirty={editor.dirty} />}
        <EditorTabs tabs={tabs} active={tab} onSelect={setTab} label="Loyalty settings" />

        {tab === "programme" && (
          <EditorPanel id="programme">
            <Card title="Loyalty programme" description={`${capitalise(profile.people)} join with their email and get a card on their phone.`}>
              {profile.professionalRules && <p className="hint" style={{ marginBottom: 12 }}>Check your professional and legal rules before offering rewards.</p>}
              <div className="preset-grid" role="group" aria-label="Loyalty programme">
                {MODES.map((option) => (
                  <button key={option.value} type="button" className="preset" aria-pressed={mode === option.value} onClick={() => setMode(option.value)}>
                    <option.icon className="preset-icon" aria-hidden />
                    <span>
                      {option.label}
                      <span className="preset-hint">{option.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            {mode === "stamps" && (
              <Card title="Rewards" description="Staff add a stamp when it's earned. When the card is full, the main reward is theirs and the card starts again.">
                <div className="row">
                  <TextField label="Main reward" value={main.rewardName} onChange={(value) => setMain({ rewardName: value ?? "" })} placeholder={profile.defaultReward ? `e.g. ${profile.defaultReward}` : "e.g. 10% off your next visit"} maxLength={80} />
                  <Field label="Stamps needed" htmlFor="stamps-required">
                    <input
                      id="stamps-required"
                      className="input"
                      type="number"
                      min={1}
                      max={50}
                      value={main.stampsRequired}
                      onChange={(event) => setMain({ stampsRequired: Math.min(50, Math.max(1, Number(event.target.value) || 1)) })}
                    />
                  </Field>
                </div>
                <TextField
                  label="How a stamp is earned (optional)"
                  value={main.stampRule}
                  onChange={(value) => setMain({ stampRule: value })}
                  placeholder={profile.stampRule ? `e.g. ${profile.stampRule}` : "e.g. 1 stamp per visit"}
                  maxLength={80}
                  hint="Shown on the card, when people join and at the till. Staff still decide when to stamp."
                />

                <div className="field" style={{ marginTop: 18 }}>
                  <span className="field-label">Smaller rewards on the way (optional)</span>
                  <div className="list-editor">
                    {earlier.map((tier, index) => (
                      <div key={index} className="list-row">
                        <div className="list-row-head">
                          <input
                            className="input"
                            aria-label="Reward"
                            placeholder="A smaller reward"
                            value={tier.rewardName}
                            maxLength={80}
                            onChange={(event) => setEarlier(earlier.map((t, i) => (i === index ? { ...t, rewardName: event.target.value } : t)))}
                          />
                          <input
                            className="input"
                            style={{ maxWidth: 90 }}
                            aria-label="Stamps"
                            type="number"
                            min={1}
                            max={Math.max(1, main.stampsRequired - 1)}
                            value={tier.stampsRequired}
                            onChange={(event) => setEarlier(earlier.map((t, i) => (i === index ? { ...t, stampsRequired: Math.min(50, Math.max(1, Number(event.target.value) || 1)) } : t)))}
                          />
                          <button type="button" className="btn btn-icon btn-ghost" aria-label="Remove reward" onClick={() => setEarlier(earlier.filter((_, i) => i !== index))}>
                            <Trash2 aria-hidden />
                          </button>
                        </div>
                      </div>
                    ))}
                    {earlier.length < 4 && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ justifySelf: "start" }}
                        onClick={() => setEarlier([...earlier, { rewardName: "", stampsRequired: Math.max(1, Math.floor(main.stampsRequired / 2)) }])}
                      >
                        <Plus aria-hidden /> Add a smaller reward
                      </button>
                    )}
                  </div>
                  {earlier.some((tier) => tier.stampsRequired >= main.stampsRequired) && <p className="field-error">Smaller rewards should need fewer stamps than the main one.</p>}
                </div>
              </Card>
            )}

            {mode === "stamps" && (
              <Card title="Refer a friend" description="Members get an invite link on their card. Once their friend's first visit is stamped, the member gets bonus stamps.">
                <SwitchRow title="Reward invites" checked={referral.enabled} onChange={(on) => setReferral({ enabled: on })} />
                {referral.enabled && (
                  <div className="row" style={{ marginTop: 6 }}>
                    <Field label="Stamps for the member who invited" htmlFor="referrer-stamps">
                      <select id="referrer-stamps" className="select" value={referral.referrerStamps} onChange={(event) => setReferral({ referrerStamps: Number(event.target.value) })}>
                        {[1, 2, 3].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Welcome stamps for the friend" htmlFor="friend-stamps">
                      <select id="friend-stamps" className="select" value={referral.friendStamps} onChange={(event) => setReferral({ friendStamps: Number(event.target.value) })}>
                        {[0, 1, 2].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}
                {referral.enabled && <p className="hint" style={{ marginTop: 10 }}>To stop abuse, a member can earn invite stamps at most 5 times a month, and only after a real visit.</p>}
                {referralStats && (referralStats.joined > 0 || referral.enabled) && (
                  <p className="hint" style={{ marginTop: 6 }}>
                    So far: {referralStats.joined} friend{referralStats.joined === 1 ? "" : "s"} joined through an invite, {referralStats.visited} visited.
                  </p>
                )}
              </Card>
            )}

            {mode === "referral" && (
              <Card
                title="Refer a friend"
                description={`Members get a card with an invite link. A friend who joins through it gets a welcome offer on their first visit, and the member gets a reward for each friend who comes in. Staff give both by scanning the card.`}
              >
                <TextField
                  label="The friend gets, on their first visit"
                  value={offers.friend}
                  onChange={(value) => setOffers({ friend: value ?? "" })}
                  placeholder={`e.g. ${DEFAULT_REFERRAL_OFFERS.friend}`}
                  maxLength={80}
                />
                <TextField
                  label="The member who invited them gets"
                  value={offers.member}
                  onChange={(value) => setOffers({ member: value ?? "" })}
                  placeholder={`e.g. ${DEFAULT_REFERRAL_OFFERS.member}`}
                  maxLength={80}
                  hint="Given at the till on their next visit, once per friend."
                />
                <p className="hint" style={{ marginTop: 10 }}>To stop abuse, a member can earn at most 5 friend rewards a month, and only after the friend really visits.</p>
                {referralStats && (
                  <p className="hint" style={{ marginTop: 6 }}>
                    So far: {referralStats.joined} friend{referralStats.joined === 1 ? "" : "s"} joined through an invite, {referralStats.visited} visited.
                  </p>
                )}
              </Card>
            )}

            {mode === "membership" && (
              <Card title="Members club">
                <p className="hint">
                  {People} join a members list from your page. There&apos;s no stamp card: members get your birthday reward, and you can export the list from{" "}
                  {People} to send your own offers to those who agreed.
                </p>
              </Card>
            )}

            {mode === "stamps" && <FeedbackStampSetting venueId={venueId} initial={feedbackStamp} />}

            {mode !== "off" && (
              <BirthdayRewardForm
                value={birthday}
                onChange={(next) => {
                  setBirthdayError(null);
                  setBirthday(next);
                }}
                collectsBirthdays={crm.enabled && crm.birthdayAsk}
                stampCard={mode === "stamps"}
                onAskBirthdays={() => setTab("capture")}
                detailsTab={`${People}' details`}
              />
            )}

          </EditorPanel>
        )}

        {tab === "capture" && (
          <EditorPanel id="capture">
            <Card title={`${People}' details`} description={`Build a list of ${profile.people} you can reach again, with their permission.`}>
              <SwitchRow title={`Collect ${lower(personWord(profile))} details`} description="The main switch for everything below." checked={crm.enabled} onChange={(on) => setCrm({ enabled: on })} />
              <SwitchRow
                title="Email for Wi-Fi"
                description={`${People} type their email to see the Wi-Fi password, and appear in your ${lower(personWord(profile))} list. Off: everyone sees the password. No stamp is given for it.`}
                checked={crm.wifiCapture}
                disabled={!crm.enabled}
                onChange={(on) => setCrm({ wifiCapture: on })}
              />
              {mode !== "off" && (
                <SwitchRow
                  title="Offer membership after feedback"
                  description={
                    mode === "stamps"
                      ? `After leaving feedback, ${profile.people} are invited to join, with a free stamp.`
                      : mode === "referral"
                        ? `After leaving feedback, ${profile.people} are invited to join and share their invite link.`
                        : `After leaving feedback, ${profile.people} are invited to join the members club.`
                  }
                  checked={crm.feedbackCapture}
                  disabled={!crm.enabled}
                  onChange={(on) => setCrm({ feedbackCapture: on })}
                />
              )}
              <SwitchRow
                title="Ask for birthdays"
                description={`Optional when ${profile.people} join your card. Day and month only, never the year. You can collect birthdays without giving a reward; a birthday reward (Rewards tab) needs this on.`}
                checked={crm.birthdayAsk}
                disabled={!crm.enabled}
                onChange={(on) => setCrm({ birthdayAsk: on })}
              />
            </Card>
          </EditorPanel>
        )}

        {tab === "till" && <EditorPanel id="till">{till}</EditorPanel>}

      </div>

      {mode !== "off" && <PreviewPane src={`${previewUrl}&embed=1`} title="Live page preview" fullHref={previewUrl} />}

      <SaveBar
        dirty={editor.dirty || birthdayDirty}
        saving={editor.saving || birthdaySaving}
        error={editor.error ?? birthdayError}
        onSave={saveAll}
        onReset={() => {
          editor.reset();
          setBirthday(savedBirthday);
          setBirthdayError(null);
        }}
      />
    </div>
  );
}
