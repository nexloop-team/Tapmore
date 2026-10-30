"use client";

import { Lightbulb, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import { capitalise } from "@/lib/venue/business";

type Summary = { headline: string; praise: string[]; problems: string[]; suggestion: string };
type State =
  | { state: "loading" }
  | { state: "ready"; summary: Summary; notes: number; createdAt: string }
  | { state: "too_few"; notes: number }
  | { state: "unavailable" }
  | { state: "error" };

/**
 * "What guests said this week" on the overview. Loaded after the page so the
 * overview never waits on the AI; hidden on servers without AI.
 */
export function FeedbackSummaryCard({ venueId, feedbackHref, people }: { venueId: string; feedbackHref: string; /** "guests", "customers" */ people: string }) {
  const [state, setState] = useState<State>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/venues/${venueId}/ai/feedback-summary`, { cache: "no-store", signal: AbortSignal.timeout(90_000) })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as Exclude<State, { state: "loading" | "error" }>;
      })
      .then((result) => !cancelled && setState(result))
      .catch(() => !cancelled && setState({ state: "error" }));
    return () => {
      cancelled = true;
    };
  }, [venueId, attempt]);

  if (state.state === "unavailable") return null;

  return (
    <section className="card feedback-summary" aria-live="polite">
      <div className="card-head">
        <div>
          <h2>
            <Sparkles aria-hidden /> What {people} said this week
          </h2>
          <p>{state.state === "ready" ? `A summary of ${state.notes} feedback notes from the last 7 days` : "A short summary of the last 7 days of feedback"}</p>
        </div>
      </div>

      {state.state === "loading" && <p className="muted">Reading this week&apos;s feedback…</p>}
      {state.state === "error" && (
        <p className="muted">
          The summary couldn&apos;t be written just now.{" "}
          <button type="button" className="link-btn" onClick={() => (setState({ state: "loading" }), setAttempt((n) => n + 1))}>
            Try again
          </button>
        </p>
      )}
      {state.state === "too_few" && (
        <p className="muted">
          Once at least 3 {people} leave feedback in a week, a short summary appears here. {state.notes > 0 && <a href={feedbackHref}>Read the {state.notes} so far</a>}
        </p>
      )}
      {state.state === "ready" && (
        <>
          <p className="feedback-summary-headline">{state.summary.headline}</p>
          <div className="feedback-summary-cols">
            {state.summary.praise.length > 0 && (
              <div>
                <h3>
                  <ThumbsUp aria-hidden /> {capitalise(people)} liked
                </h3>
                <ul>
                  {state.summary.praise.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {state.summary.problems.length > 0 && (
              <div>
                <h3>
                  <ThumbsDown aria-hidden /> Needs attention
                </h3>
                <ul>
                  {state.summary.problems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {state.summary.suggestion && (
            <p className="feedback-summary-tip">
              <Lightbulb aria-hidden /> <span>{state.summary.suggestion}</span>
            </p>
          )}
          <p className="hint">Written by AI from your guests&apos; notes, so check the notes themselves before acting on it.</p>
        </>
      )}
    </section>
  );
}
