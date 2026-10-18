"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";

export function Field({ label, hint, error, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

/** Text input bound to a nullable string: empty means null, so cleared fields don't save as "". */
export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  type = "text",
  maxLength,
  multiline,
  autoComplete,
  required,
  onBlur,
}: {
  label: ReactNode;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  hint?: ReactNode;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  multiline?: boolean;
  autoComplete?: string;
  required?: boolean;
}) {
  const id = useId();
  const common = {
    id,
    value: value ?? "",
    placeholder,
    maxLength,
    required,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value === "" ? null : event.target.value),
    onBlur,
  };
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      {multiline ? <textarea className="textarea" {...common} /> : <input className="input" type={type} autoComplete={autoComplete} enterKeyHint="done" {...common} />}
    </Field>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span />
    </span>
  );
}

export function SwitchRow({ title, description, checked, onChange, disabled }: { title: string; description?: ReactNode; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <div className="switch-row">
      <div>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
      <Switch label={title} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/** A one-line "How do I…?" that opens a short answer in place: help exactly where people get stuck. */
export function HelpTip({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details className="help-tip">
      <summary>{question}</summary>
      <div className="help-tip-body">{children}</div>
    </details>
  );
}

export function Card({ id, title, description, actions, children, className }: { id?: string; title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`card ${className ?? ""}`}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Floating bar that appears while there are unsaved changes. */
export function SaveBar({ dirty, saving, error, onSave, onReset }: { dirty: boolean; saving: boolean; error: string | null; onSave: () => void; onReset: () => void }) {
  if (!dirty && !error) return null;
  return (
    <div className="savebar" role="status">
      {error ? <span className="savebar-error">{error}</span> : <span>Unsaved changes</span>}
      <button type="button" className="btn btn-ghost btn-sm" onClick={onReset} disabled={saving}>
        Discard
      </button>
      <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={saving || !dirty}>
        {saving && <Loader2 className="spin" />}
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

/** Upload-or-remove control for a venue image; reports the new public URL. */
export function ImageField({
  venueId,
  label,
  value,
  onChange,
  hint,
  wide,
  kind,
}: {
  venueId: string;
  label: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  hint?: string;
  wide?: boolean;
  /** What the image is for: it's stored at that use's size. */
  kind: "logo" | "cover" | "dish";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      onChange(await dashboardApi.uploadImage(venueId, file, kind));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="image-field">
        <div className={`image-preview ${wide ? "wide" : ""}`} style={value ? { backgroundImage: `url("${value.replace(/"/g, "")}")` } : undefined}>
          {!value && <ImagePlus aria-hidden />}
        </div>
        <div className="inline">
          <button type="button" className="btn btn-sm" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="spin" /> : null}
            {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          </button>
          {value && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange(null)} disabled={busy}>
              <X aria-hidden /> Remove
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
      {error ? <p className="field-error">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          window.prompt("Copy this link", text);
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function newClientId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
