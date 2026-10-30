"use client";

import { Loader2, Mail, Trash2, UserRound } from "lucide-react";
import { lower, personWord } from "@/lib/venue/business";
import { useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { formatDate } from "@/lib/format";
import { useConfirm } from "./confirm";
import { useToast } from "./toast";
import { Card, CopyButton, HelpTip } from "./ui";

interface StaffMemberView {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
}

/**
 * Staff logins: people the owner invites by email. Signing in only lets them
 * open the till on their own phone; they never see the dashboard, billing or
 * the guest list.
 */
export function StaffMembers({ venueId, members, people }: { venueId: string; members: StaffMemberView[]; people: string }) {
  const ask = useConfirm();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; url: string } | null>(null);
  /** Removed here: gone from the list at once, without fetching the page again. */
  const [removed, setRemoved] = useState<string[]>([]);
  const listed = members.filter((member) => !removed.includes(member.userId));

  async function invite() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await dashboardApi.inviteStaff(venueId, email);
      setSent({ email: email.trim(), url });
      setEmail("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(member: StaffMemberView) {
    const ok = await ask({
      title: `Remove ${member.name || member.email}?`,
      body: "They won't be able to open the till any more, and the till on their phone stops working straight away.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await dashboardApi.removeStaff(venueId, member.userId);
      toast({ text: `${member.name || member.email} can no longer open the till.` });
      setRemoved((ids) => [...ids, member.userId]);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card id="staff" title="Staff logins" description={`Give each team member their own login. It only opens the till: no dashboard, billing or ${lower(personWord({ people }))} list.`}>
      {listed.length > 0 && (
        <div className="list-editor" style={{ marginBottom: 14 }}>
          {listed.map((member) => (
            <div key={member.userId} className="list-row">
              <div className="list-row-head">
                <UserRound size={18} aria-hidden />
                <span className="grow">
                  <strong>{member.name || member.email}</strong>
                  <span className="hint" style={{ display: "block" }}>
                    {member.email} · joined {formatDate(member.joinedAt)}
                  </span>
                </span>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(member)}>
                  <Trash2 aria-hidden /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sent && (
        <div className="notice notice-ok" style={{ display: "block", marginBottom: 14 }}>
          Invite sent to <strong>{sent.email}</strong>. You can also send them this link (it works once, for 7 days):
          <div className="share-link" style={{ marginTop: 10 }}>
            <code>{sent.url}</code>
            <CopyButton text={sent.url} />
          </div>
        </div>
      )}

      <form
        className="inline"
        onSubmit={(event) => {
          event.preventDefault();
          void invite();
        }}
      >
        <input className="input" style={{ flex: 1, minWidth: 180 }} type="email" aria-label="Staff member's email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        <button type="submit" className="btn" disabled={busy || !email.trim()}>
          {busy ? <Loader2 className="spin" aria-hidden /> : <Mail aria-hidden />} Send invite
        </button>
      </form>
      {error && <p className="field-error" style={{ marginTop: 8 }}>{error}</p>}

      <HelpTip question="Staff logins or a staff device: which should I use?">
        <p>
          A <strong>staff device</strong> is a phone or tablet that stays at the till: anyone holding it can stamp. A <strong>staff login</strong> is for someone using their own phone: they sign in, tap
          &ldquo;Open the till&rdquo;, and you can remove them when they leave.
        </p>
      </HelpTip>
    </Card>
  );
}
