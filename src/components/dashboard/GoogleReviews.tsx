"use client";

import { Loader2, RefreshCw, Sparkles, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import type { VenueSettings } from "@/lib/venue/settings";
import { useConfirm } from "./confirm";
import { useToast } from "./toast";
import { Card, Field, SwitchRow } from "./ui";

/** One Google review as the page shows it (dates already formatted on the server). */
export interface ReviewView {
  id: string;
  reviewerName: string | null;
  stars: number;
  comment: string | null;
  dateLabel: string;
  replyText: string | null;
  replyDateLabel: string | null;
  state: "replied" | "awaiting" | "skipped" | "failed" | "none";
  draftText: string | null;
  postedAutomatically: boolean;
}

function Stars({ count }: { count: number }) {
  return (
    <span className="review-stars" aria-label={count ? `${count} out of 5 stars` : "No rating"}>
      {"★".repeat(count)}
      <span aria-hidden>{"★".repeat(Math.max(0, 5 - count))}</span>
    </span>
  );
}

/** One review: its reply on Google, or a draft to check, edit and post. */
export function ReviewCard({ venueId, review }: { venueId: string; review: ReviewView }) {
  const router = useRouter();
  const toast = useToast();
  const replied = review.state === "replied" && !!review.replyText;
  const waiting = review.state === "awaiting" || review.state === "failed";
  const [editing, setEditing] = useState(waiting);
  const [text, setText] = useState(replied ? (review.replyText ?? "") : (review.draftText ?? ""));
  const [busy, setBusy] = useState<"post" | "rewrite" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "post" | "rewrite" | "skip", action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const post = () =>
    run("post", async () => {
      await dashboardApi.reviewReply(venueId, { reviewId: review.id, text });
      toast({ text: "Reply posted on Google" });
      setEditing(false);
      router.refresh();
    });
  const rewrite = () =>
    run("rewrite", async () => {
      const { draft } = await dashboardApi.reviewRedraft(venueId, { reviewId: review.id });
      setText(draft);
    });
  const skip = () =>
    run("skip", async () => {
      await dashboardApi.reviewSkip(venueId, { reviewId: review.id });
      router.refresh();
    });

  return (
    <li className="card review-card">
      <div className="review-head">
        <Stars count={review.stars} />
        <strong>{review.reviewerName || "A Google user"}</strong>
        <span className="muted">{review.dateLabel}</span>
      </div>
      {review.comment ? <p className="review-text">{review.comment}</p> : <p className="review-text muted">No written review, just the stars.</p>}

      {replied && !editing && (
        <div className="review-reply">
          <span className="review-reply-label">
            Your reply{review.postedAutomatically ? " · posted automatically" : ""}
            {review.replyDateLabel ? ` · ${review.replyDateLabel}` : ""}
          </span>
          <p>{review.replyText}</p>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(true)}>
            Edit reply
          </button>
        </div>
      )}

      {review.state === "failed" && <p className="hint">This reply couldn&apos;t be posted automatically. Check it, then post it.</p>}
      {review.state === "skipped" && !editing && <p className="hint">You chose not to reply to this one.</p>}

      {editing ? (
        <div className="review-editor">
          <textarea
            className="input"
            rows={4}
            maxLength={1500}
            value={text}
            placeholder="Write your reply. Everyone sees it on Google as the owner's response."
            onChange={(event) => setText(event.target.value)}
            aria-label="Your reply"
          />
          <div className="inline">
            <button type="button" className="btn btn-primary btn-sm" onClick={post} disabled={!!busy || !text.trim()}>
              {busy === "post" && <Loader2 className="spin" aria-hidden />} Post reply
            </button>
            <button type="button" className="btn btn-sm" onClick={rewrite} disabled={!!busy}>
              {busy === "rewrite" ? <Loader2 className="spin" aria-hidden /> : <Sparkles aria-hidden />} {text.trim() ? "Rewrite with AI" : "Write with AI"}
            </button>
            {replied ? (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)} disabled={!!busy}>
                Cancel
              </button>
            ) : (
              review.state !== "skipped" && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={skip} disabled={!!busy}>
                  Don&apos;t reply
                </button>
              )
            )}
          </div>
        </div>
      ) : (
        !replied && (
          <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
            Reply
          </button>
        )
      )}
      {error && <p className="field-error">{error}</p>}
    </li>
  );
}

/** The connected Business Profile, "Check now" and "Disconnect". */
export function ReviewsToolbar({ venueId, title, lastSynced }: { venueId: string; title: string; lastSynced: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);

  async function sync() {
    setBusy("sync");
    try {
      const { added, posted } = await dashboardApi.reviewsSync(venueId);
      toast({ text: added === 0 ? "No new reviews" : `${added} new review${added === 1 ? "" : "s"}${posted ? `, ${posted} replied automatically` : ""}` });
      router.refresh();
    } catch (err) {
      toast({ text: errorMessage(err), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    const ok = await confirm({
      title: "Disconnect Google?",
      body: "Tapmore stops reading and replying to your Google reviews, and deletes the reviews it saved. Replies already on Google stay there.",
      confirmLabel: "Disconnect",
      danger: true,
    });
    if (!ok) return;
    setBusy("disconnect");
    try {
      await dashboardApi.reviewsDisconnect(venueId);
      router.refresh();
    } catch (err) {
      toast({ text: errorMessage(err), tone: "error" });
      setBusy(null);
    }
  }

  return (
    <Card
      title={title}
      description={lastSynced ? `Connected to Google · last checked ${lastSynced}` : "Connected to Google"}
      actions={
        <div className="inline">
          <button type="button" className="btn btn-sm" onClick={sync} disabled={!!busy}>
            {busy === "sync" ? <Loader2 className="spin" aria-hidden /> : <RefreshCw aria-hidden />} Check now
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={disconnect} disabled={!!busy}>
            <Unplug aria-hidden /> Disconnect
          </button>
        </div>
      }
    >
      <p className="hint">New reviews arrive here within minutes of being posted on Google.</p>
    </Card>
  );
}

/** Auto-reply, alerts and sign-off: saved together with the button. */
export function ReviewSettingsForm({ venueId, initial }: { venueId: string; initial: VenueSettings["reviews"] }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await dashboardApi.updateSettings(venueId, { reviews: draft });
      setSaved(result.reviews);
      setDraft(result.reviews);
      setMessage({ ok: true, text: "Saved." });
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Replies" description="How Tapmore answers new reviews. Reviews from before you connected are never answered automatically.">
      <SwitchRow
        title="Reply to 4–5★ reviews automatically"
        description="An AI reply in your business's name goes on Google straight away. Off: they wait for you, with a reply drafted."
        checked={draft.autoReply}
        onChange={(on) => setDraft({ ...draft, autoReply: on })}
      />
      <SwitchRow
        title="Reply to 1–3★ reviews automatically"
        description="Off: they wait for you, with a reply drafted, so you can check what's said about a complaint before it's public."
        checked={draft.autoReplyCritical}
        onChange={(on) => setDraft({ ...draft, autoReplyCritical: on })}
      />
      <Field label="Sign-off (optional)" htmlFor="review-sign-off" hint="The last line of every reply, e.g. “Team Juniper”.">
        <input id="review-sign-off" className="input" maxLength={60} value={draft.signOff} onChange={(event) => setDraft({ ...draft, signOff: event.target.value })} />
      </Field>
      <div className="inline" style={{ marginTop: 14 }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || busy}>
          {busy && <Loader2 className="spin" aria-hidden />} Save reply settings
        </button>
        {message && <span className={message.ok ? "hint" : "field-error"}>{message.text}</span>}
      </div>
    </Card>
  );
}

/** The connected Google account manages several Business Profiles: which one is this venue. */
export function LocationPicker({ venueId, choices }: { venueId: string; choices: { account: string; location: string; title: string; address: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(account: string, location: string) {
    setBusy(location);
    setError(null);
    try {
      await dashboardApi.reviewsChooseLocation(venueId, { account, location });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  return (
    <Card title="Which business is this?" description="Your Google account manages more than one Business Profile. Pick the one for this venue.">
      <ul className="review-locations">
        {choices.map((choice) => (
          <li key={`${choice.account}/${choice.location}`}>
            <span>
              <strong>{choice.title}</strong>
              {choice.address && <span className="muted">{choice.address}</span>}
            </span>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => choose(choice.account, choice.location)} disabled={!!busy}>
              {busy === choice.location && <Loader2 className="spin" aria-hidden />} This one
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="field-error">{error}</p>}
    </Card>
  );
}
