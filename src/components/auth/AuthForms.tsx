"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { safeNext } from "@/lib/safe-next";
import { captchaEnabled, captchaToken, resetTurnstile, Turnstile } from "./Turnstile";

function useSubmit(run: (form: FormData) => Promise<void>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The robot check has passed (or there is none): until then the form waits rather than fail. */
  const [verified, setVerified] = useState(!captchaEnabled);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await run(new FormData(event.currentTarget));
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
      // Tokens are single-use: a fresh check starts, and the form waits for it again.
      if (captchaEnabled) setVerified(false);
      resetTurnstile();
    }
  }
  return { pending, error, onSubmit, verified, setVerified };
}

function Input({
  label,
  name,
  type = "text",
  autoComplete,
  hint,
  minLength,
  autoFocus,
  placeholder,
  enterKeyHint = "next",
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  minLength?: number;
  autoFocus?: boolean;
  placeholder?: string;
  /** The phone keyboard's Enter key: "next" between fields, "go" or "send" on the last. */
  enterKeyHint?: "next" | "go" | "send";
}) {
  const [shown, setShown] = useState(false);
  const password = type === "password";
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <span className={password ? "password-field" : undefined}>
        <input className="input" id={name} name={name} type={password && shown ? "text" : type} autoComplete={autoComplete} required minLength={minLength} autoFocus={autoFocus} placeholder={placeholder} enterKeyHint={enterKeyHint} />
        {password && (
          <button type="button" className="password-toggle" aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown} onClick={() => setShown((value) => !value)}>
            {shown ? "Hide" : "Show"}
          </button>
        )}
      </span>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function Submit({ pending, waiting = false, children }: { pending: boolean; waiting?: boolean; children: ReactNode }) {
  return (
    <button className="btn btn-primary btn-block" type="submit" disabled={pending || waiting}>
      {pending ? "Please wait…" : waiting ? "Checking you're not a robot…" : children}
    </button>
  );
}

function ErrorNotice({ error }: { error: string | null }) {
  return error ? (
    <div className="notice notice-error" role="alert" style={{ marginTop: 16 }}>
      {error}
    </div>
  ) : null;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const { pending, error, onSubmit } = useSubmit(async (form) => {
    const { home } = await dashboardApi.login({ email: text(form, "email"), password: text(form, "password") });
    // Straight to their venue, not via /dashboard's redirect.
    router.replace(next ? safeNext(next) : home);
  });
  return (
    <form onSubmit={onSubmit} noValidate={false}>
      <Input label="Email" name="email" type="email" autoComplete="email" autoFocus />
      <Input label="Password" name="password" type="password" autoComplete="current-password" enterKeyHint="go" />
      <p className="hint" style={{ marginTop: 8 }}>
        <Link href="/forgot-password">Forgot your password?</Link>
      </p>
      <ErrorNotice error={error} />
      <Submit pending={pending}>Sign in</Submit>
    </form>
  );
}

export function SignupForm({ next, staffVenue }: { next?: string; staffVenue?: string | null }) {
  const router = useRouter();
  const { pending, error, onSubmit, verified, setVerified } = useSubmit(async (form) => {
    await dashboardApi.signup({ name: text(form, "name"), email: text(form, "email"), password: text(form, "password"), captchaToken: captchaToken(form) });
    router.replace(safeNext(next, "/onboarding"));
  });
  return (
    <form onSubmit={onSubmit}>
      <Input label="Your name" name="name" autoComplete="name" autoFocus placeholder="Priya Sharma" />
      <Input label="Email" name="email" type="email" autoComplete="email" placeholder="you@yourcafe.in" />
      <Input label="Password" name="password" type="password" autoComplete="new-password" minLength={8} hint="At least 8 characters." enterKeyHint="go" />
      <Turnstile onSolved={setVerified} />
      <ErrorNotice error={error} />
      <Submit pending={pending} waiting={!verified}>
        {staffVenue ? "Join and open the till" : "Create my account"}
      </Submit>
      <p className="hint" style={{ marginTop: 12, textAlign: "center" }}>
        By signing up you agree to our <Link href="/terms">Terms</Link>, <Link href="/privacy">Privacy policy</Link> and{" "}
        <Link href="/refunds">Refund policy</Link>.
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const { pending, error, onSubmit, verified, setVerified } = useSubmit(async (form) => {
    await dashboardApi.forgotPassword({ email: text(form, "email"), captchaToken: captchaToken(form) });
    setSent(true);
  });
  if (sent) {
    return (
      <div className="notice notice-ok" role="status">
        If an account exists for that address, a reset link is on its way. It works for one hour.
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit}>
      <Input label="Email" name="email" type="email" autoComplete="email" autoFocus enterKeyHint="send" />
      <Turnstile onSolved={setVerified} />
      <ErrorNotice error={error} />
      <Submit pending={pending} waiting={!verified}>
        Send reset link
      </Submit>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { pending, error, onSubmit } = useSubmit(async (form) => {
    if (text(form, "password") !== text(form, "confirm")) throw new Error("The two passwords don't match");
    await dashboardApi.resetPassword({ token, password: text(form, "password") });
    router.replace("/dashboard");
  });
  return (
    <form onSubmit={onSubmit}>
      <Input label="New password" name="password" type="password" autoComplete="new-password" minLength={8} hint="At least 8 characters." autoFocus />
      <Input label="Confirm new password" name="confirm" type="password" autoComplete="new-password" minLength={8} enterKeyHint="go" />
      <ErrorNotice error={error} />
      <Submit pending={pending}>Set new password</Submit>
    </form>
  );
}
