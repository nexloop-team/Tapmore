"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { BUSINESS_GROUPS, businessProfile, RETIRED_TYPES } from "@/lib/venue/business";
import { CURRENCIES } from "@/lib/venue/constants";
import type { VenueConfig } from "@/lib/venue/schema";
import { useConfirm } from "./confirm";
import { Card, Field, SaveBar, TextField } from "./ui";
import { useVenueDraft } from "./useVenueDraft";

type Basics = Pick<VenueConfig, "name" | "venueType" | "currencyCode">;

export function VenueBasicsForm({ venueId, initial }: { venueId: string; initial: Basics }) {
  // Compiled by the React Compiler (annotation mode, see next.config): re-renders only what an edit touches.
  "use memo";
  const editor = useVenueDraft<Basics>(venueId, initial);
  const { draft, update } = editor;
  return (
    <Card title="Business details">
      <TextField label="Business name" value={draft.name} onChange={(value) => update("name", value ?? "")} maxLength={80} />
      <div className="row" style={{ marginTop: 14 }}>
        <Field
          label="Type of business"
          htmlFor="venue-type"
          hint={
            // Switching type keeps everything: food details are only hidden, and the menu keeps its name.
            draft.venueType !== initial.venueType
              ? `Your ${businessProfile(initial.venueType).catalogue.toLowerCase()} keeps its name and items. Rename it on the ${businessProfile(draft.venueType).catalogue} page if you like.`
              : "Sets the words your page and dashboard use, like Menu or Products."
          }
        >
          <select id="venue-type" className="select" value={draft.venueType ?? "cafe"} onChange={(event) => update("venueType", event.target.value as Basics["venueType"])}>
            {BUSINESS_GROUPS.map((group) => (
              <optgroup key={group.group} label={group.label}>
                {group.types.map((type) => (
                  <option key={type} value={type}>
                    {businessProfile(type).label} ({businessProfile(type).hint.toLowerCase()})
                  </option>
                ))}
              </optgroup>
            ))}
            {/* A type no longer offered ("Pub", "Other") stays selectable for venues that already have it. */}
            {initial.venueType && RETIRED_TYPES.includes(initial.venueType) && <option value={initial.venueType}>{businessProfile(initial.venueType).label}</option>}
          </select>
        </Field>
        <Field label="Currency" htmlFor="currency">
          <select id="currency" className="select" value={draft.currencyCode} onChange={(event) => update("currencyCode", event.target.value as Basics["currencyCode"])}>
            {CURRENCIES.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </Field>
      </div>
      <SaveBar dirty={editor.dirty} saving={editor.saving} error={editor.error} onSave={editor.save} onReset={editor.reset} />
    </Card>
  );
}

function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  async function run(fn: () => Promise<string | void>) {
    setPending(true);
    setError(null);
    setDone(null);
    try {
      const message = await fn();
      if (message) setDone(message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }
  return { pending, error, done, run };
}

function Status({ error, done }: { error: string | null; done: string | null }) {
  if (error) return <p className="field-error" style={{ marginTop: 10 }}>{error}</p>;
  if (done) return <p className="hint" style={{ marginTop: 10, color: "var(--a-ok)" }}>{done}</p>;
  return null;
}

export function ShortCodeForm({ venueId, shortCode, origin }: { venueId: string; shortCode: string; origin: string }) {
  const router = useRouter();
  const [value, setValue] = useState(shortCode);
  const action = useAction();
  const ask = useConfirm();
  const changed = value.trim().toLowerCase() !== shortCode;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!(await ask({ title: "Change your page address?", body: "QR codes you've already printed keep working: the old address leads to the new one. New downloads use the new address.", confirmLabel: "Change address" }))) return;
    void action.run(async () => {
      await dashboardApi.updateVenue(venueId, { shortCode: value.trim().toLowerCase() });
      router.refresh();
      return "Saved. Printed codes still work; new downloads use the new address.";
    });
  }

  return (
    <Card title="Page address" description="The code inside your QR codes and links.">
      <form onSubmit={submit}>
        <div className="input-prefix">
          <span>{origin.replace(/^https?:\/\//, "")}/s?i=</span>
          <input className="input" aria-label="Page address" value={value} onChange={(event) => setValue(event.target.value)} maxLength={40} />
        </div>
        <p className="hint" style={{ marginTop: 6 }}>Lower-case letters, numbers and hyphens. Old printed codes keep working after a change.</p>
        <button className="btn" type="submit" style={{ marginTop: 12 }} disabled={!changed || action.pending}>
          {action.pending && <Loader2 className="spin" aria-hidden />} Change address
        </button>
        <Status error={action.error} done={action.done} />
      </form>
    </Card>
  );
}

export function DeleteVenueForm({ venueId, name }: { venueId: string; name: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const action = useAction();
  return (
    <Card title="Delete this business" description="Removes the page, its menu or products, customers, feedback and photos for good. Printed QR codes stop working." className="danger-zone">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void action.run(async () => {
            await dashboardApi.deleteVenue(venueId, confirm);
            router.replace("/dashboard");
            router.refresh();
          });
        }}
      >
        <Field label={<>Type <strong>{name}</strong> to confirm</>} htmlFor="confirm-delete">
          <input id="confirm-delete" className="input" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" />
        </Field>
        <button className="btn btn-danger" type="submit" style={{ marginTop: 12 }} disabled={confirm.trim() !== name.trim() || action.pending}>
          Delete business
        </button>
        <Status error={action.error} done={null} />
      </form>
    </Card>
  );
}

/** Profile, then password and deletion (which stays last). */
export function AccountForms({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const profile = useAction();
  const password = useAction();
  const removal = useAction();
  const ask = useConfirm();
  const [displayName, setDisplayName] = useState(name);
  // Password and deletion stay folded until asked for: most visits only need the profile.
  const [changing, setChanging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <Card title="Profile" description="How you appear to your team and in emails.">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void profile.run(async () => {
              await dashboardApi.updateAccount({ name: displayName });
              router.refresh();
              return "Saved.";
            });
          }}
        >
          <div className="row">
            <Field label="Name" htmlFor="account-name">
              <input id="account-name" className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required />
            </Field>
            <Field label="Email" htmlFor="account-email" hint="Contact us to change your sign-in email.">
              <input id="account-email" className="input" value={email} disabled />
            </Field>
          </div>
          <button className="btn" type="submit" style={{ marginTop: 12 }} disabled={profile.pending || displayName.trim() === name}>
            Save
          </button>
          <Status error={profile.error} done={profile.done} />
        </form>
      </Card>


      <Card
        title="Password"
        description={changing ? "Changing it signs you out on your other devices." : "Sign-ins stay active on this device for 90 days."}
        actions={
          !changing && (
            <button type="button" className="btn btn-sm" onClick={() => setChanging(true)}>
              Change password
            </button>
          )
        }
      >
        {changing && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const target = event.currentTarget;
              void password.run(async () => {
                if (form.get("new") !== form.get("confirm")) throw new Error("The new passwords don't match");
                await dashboardApi.changePassword({ currentPassword: String(form.get("current")), newPassword: String(form.get("new")) });
                target.reset();
                setChanging(false);
                return "Password changed. Other devices have been signed out.";
              });
            }}
          >
            <Field label="Current password" htmlFor="pw-current">
              <input id="pw-current" name="current" className="input" type="password" autoComplete="current-password" required />
            </Field>
            <div className="row" style={{ marginTop: 14 }}>
              <Field label="New password" htmlFor="pw-new" hint="At least 8 characters.">
                <input id="pw-new" name="new" className="input" type="password" autoComplete="new-password" minLength={8} required />
              </Field>
              <Field label="Confirm new password" htmlFor="pw-confirm">
                <input id="pw-confirm" name="confirm" className="input" type="password" autoComplete="new-password" minLength={8} required />
              </Field>
            </div>
            <div className="inline" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" type="submit" disabled={password.pending}>
                Change password
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setChanging(false)}>
                Cancel
              </button>
            </div>
            <Status error={password.error} done={null} />
          </form>
        )}
        {!changing && <Status error={null} done={password.done} />}
      </Card>

      <Card
        title="Delete account"
        description="Deletes your account and every business you own alone, with all of their customer data. This can't be undone."
        className="danger-zone"
        actions={
          !deleting && (
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleting(true)}>
              Delete account
            </button>
          )
        }
      >
        {deleting && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              if (!(await ask({ title: "Delete your account?", body: "Your account and every business you own alone are deleted for good, with all their customer data.", confirmLabel: "Delete account", danger: true }))) return;
              void removal.run(async () => {
                await dashboardApi.deleteAccount({ password: String(form.get("password")) });
                router.replace("/");
                router.refresh();
              });
            }}
          >
            <Field label="Your password" htmlFor="delete-password">
              <input id="delete-password" name="password" className="input" type="password" autoComplete="current-password" required />
            </Field>
            <div className="inline" style={{ marginTop: 12 }}>
              <button className="btn btn-danger" type="submit" disabled={removal.pending}>
                Delete my account
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setDeleting(false)}>
                Cancel
              </button>
            </div>
            <Status error={removal.error} done={null} />
          </form>
        )}
      </Card>
    </>
  );
}
