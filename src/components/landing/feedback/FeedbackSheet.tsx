"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { FeedbackResponse } from "@/lib/api/contracts";
import { Field } from "../forms";
import { FEEDBACK_TEXTAREA_ID, useLanding } from "../LandingContext";
import { FeedbackThankYou } from "./FeedbackThankYou";
import { PhotoAttach, type AttachedPhoto } from "./PhotoAttach";

/** The thank-you never appears faster than this, so it reads as "sent" rather than a flicker. */
const MIN_SENDING_MS = 800;

type Phase = { kind: "form" } | { kind: "sending" } | { kind: "thanks"; text: string; score: number; receipt: FeedbackResponse["stampReceipt"] };

export function FeedbackSheet() {
  const { venue, t, track, source } = useLanding();
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<AttachedPhoto | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [error, setError] = useState<string | null>(null);
  const startedTracked = useRef(false);

  const trimmed = text.trim();
  const sending = phase.kind === "sending";

  async function submit() {
    if (!trimmed || sending) return;
    setPhase({ kind: "sending" });
    setError(null);
    const started = Date.now();
    try {
      const result = await api.submitFeedback({ venueId: venue.id, text: trimmed, source, imageBase64: photo?.base64 });
      const wait = MIN_SENDING_MS - (Date.now() - started);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      const score = result.sentimentScore;
      track("feedback_submitted", {
        sentiment: score > 0.5 ? "pos" : score < -0.5 ? "neg" : "neu",
        feedback_length: trimmed.length,
        has_image: !!photo,
      });
      setPhase({ kind: "thanks", text: trimmed, score, receipt: result.stampReceipt });
    } catch {
      // Unlike a fire-and-forget post, a failure is shown and the text is kept for a retry.
      setError(t("something_wrong"));
      setPhase({ kind: "form" });
    }
  }

  if (phase.kind === "thanks") {
    return (
      <div className="sheet-inner fade-in">
        <FeedbackThankYou text={phase.text} score={phase.score} receipt={phase.receipt} />
      </div>
    );
  }

  return (
    <div className="sheet-inner">
      <p className="sheet-intro">{t("share_thoughts")}</p>
      <div className="form-stack">
        <Field label={t("your_message")}>
          <textarea
            id={FEEDBACK_TEXTAREA_ID}
            className="feedback-textarea"
            placeholder={t("what_went_well")}
            rows={4}
            value={text}
            maxLength={5000}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => {
              if (!startedTracked.current) {
                startedTracked.current = true;
                track("feedback_started");
              }
            }}
          />
        </Field>
        <div className="feedback-actions">
          <PhotoAttach photo={photo} onChange={setPhoto} />
          <button type="button" className={`feedback-submit-btn${sending ? " loading" : ""}`} disabled={!trimmed || sending} onClick={submit} aria-busy={sending}>
            {t("send_feedback")}
            {sending && <span className="spinner" aria-hidden />}
          </button>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
    </div>
  );
}
