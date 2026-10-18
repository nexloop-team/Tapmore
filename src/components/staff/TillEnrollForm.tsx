"use client";

import { Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { daysInMonth, isPlausibleEmail, normaliseEmail } from "@/lib/validation";

/**
 * Staff sign a guest up at the counter (no phone to hand, or easier this way).
 * Staff tick that the guest agreed to join; the guest gets their card by
 * email and the till opens it so the first stamp can go on straight away.
 */
export function TillEnrollForm({ asksBirthday, adultAge }: { asksBirthday: boolean; adultAge: 13 | 18 }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [month, setMonth] = useState(0);
  const [day, setDay] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = name.trim().length > 0 && isPlausibleEmail(normaliseEmail(email)) && agreed;

  async function submit() {
    if (!valid) {
      setError(agreed ? "Enter the guest's name and email address." : "Ask the guest if they agree to join, then tick the box.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { cardId, wasExisting } = await dashboardApi.staffEnroll({
        name: name.trim(),
        email: normaliseEmail(email),
        birthday: asksBirthday && month && day ? { month, day } : undefined,
        agreed: true,
      });
      router.push(`/staff/stamp?c=${encodeURIComponent(cardId)}&joined=${wasExisting ? "existing" : "new"}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form
      className="till-enroll"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className="field">
        <span>Guest&apos;s name</span>
        <input className="input" type="text" enterKeyHint="next" autoComplete="off" autoCorrect="off" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="field">
        <span>Email address</span>
        <input className="input" type="email" enterKeyHint="done" inputMode="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      {asksBirthday && (
        <div className="field">
          <span>Birthday (if they&apos;d like)</span>
          <div className="till-enroll-row">
            <select
              className="select"
              aria-label="Month"
              value={month}
              onChange={(event) => {
                const next = Number(event.target.value);
                setMonth(next);
                if (next && day > daysInMonth(next)) setDay(0);
              }}
            >
              <option value={0}>Month</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleDateString("en-IN", { month: "long" })}
                </option>
              ))}
            </select>
            <select className="select" aria-label="Day" value={day} onChange={(event) => setDay(Number(event.target.value))}>
              <option value={0}>Day</option>
              {Array.from({ length: month ? daysInMonth(month) : 31 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <label className="till-agree">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
        <span>The guest agrees to join and get their card, rewards and birthday wishes by email, and says they&apos;re {adultAge} or older.</span>
      </label>
      <p className="till-hint">They&apos;ll get their card by email, and you can stamp it straight away.</p>
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      <button type="submit" className="staff-btn staff-btn-primary staff-btn-xl" disabled={busy}>
        {busy ? <Loader2 className="spin" aria-hidden /> : <UserPlus aria-hidden />} Add member
      </button>
    </form>
  );
}
