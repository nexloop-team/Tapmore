"use client";

import { Loader2, Plus, Smartphone, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatSince } from "@/lib/format";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { useConfirm } from "./confirm";
import { Card, CopyButton, Field, HelpTip } from "./ui";

const COOLDOWNS = [
  { value: 0, label: "No limit" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 240, label: "4 hours" },
];

/** Pair till phones/tablets for stamping, revoke them, and set the stamp cooldown. */
/** "4 min ago", "2 h ago", "Yesterday": recent enough to spot a till that's gone quiet. */
function lastUsed(at: string): string {
  const since = formatSince(at);
  return /(min| h)$/.test(since) ? `${since} ago` : since.toLowerCase();
}

export function StaffDevices({
  venueId,
  devices,
  cooldownMinutes,
  enabled,
}: {
  venueId: string;
  devices: { id: string; label: string; createdAt: string; lastUsedAt: string | null }[];
  cooldownMinutes: number;
  /** Stamping only works on a live stamp card. */
  enabled: boolean;
}) {
  const router = useRouter();
  const ask = useConfirm();
  const [label, setLabel] = useState("Front till");
  const [pairing, setPairing] = useState<{ url: string; qrSvg: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(cooldownMinutes);
  /** Unpaired here: gone from the list at once, without fetching the page again. */
  const [unpaired, setUnpaired] = useState<string[]>([]);
  const listed = devices.filter((device) => !unpaired.includes(device.id));

  async function addDevice() {
    setBusy(true);
    setError(null);
    try {
      setPairing(await dashboardApi.addStaffDevice(venueId, { label }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string, name: string) {
    if (!(await ask({ title: `Unpair “${name}”?`, body: "It stops being able to stamp cards straight away.", confirmLabel: "Unpair device", danger: true }))) return;
    try {
      await dashboardApi.revokeStaffDevice(venueId, id);
      setUnpaired((ids) => [...ids, id]);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function saveCooldown(value: number) {
    setCooldown(value);
    try {
      await dashboardApi.updateSettings(venueId, { stampPolicy: { cooldownMinutes: value } });
    } catch (err) {
      setError(errorMessage(err));
    }
  }


  return (
    <Card title="Staff devices" description="Phones or tablets at the till that can stamp cards. Guests tap “Show to staff” on their card; staff scan it with the device's camera.">
      {!enabled && <p className="hint" style={{ marginBottom: 12 }}>Turn on a stamp card above (and save) to start stamping.</p>}
      <HelpTip question="How do I set up the till phone or tablet?">
        <ol>
          <li>Type a name for the device, like &ldquo;Front counter&rdquo;, and tap <strong>Add a staff device</strong>.</li>
          <li>On the till phone or tablet, scan the code that appears with its camera (or send it the link). It works once, for 15 minutes.</li>
          <li>The device opens the staff screen and stays signed in. Add it to the home screen so staff can find it fast.</li>
        </ol>
        <p>Lost a device? Tap <strong>Unpair</strong> and it stops working straight away.</p>
      </HelpTip>

      {listed.length > 0 && (
        <div className="list-editor" style={{ marginBottom: 14 }}>
          {listed.map((device) => (
            <div key={device.id} className="list-row">
              <div className="list-row-head">
                <Smartphone size={18} aria-hidden />
                <span className="grow">
                  <strong>{device.label}</strong>
                  {/* Relative time: server and browser may round it differently. */}
                  <span className="hint" style={{ display: "block" }} suppressHydrationWarning>
                    {device.lastUsedAt ? `Last used ${lastUsed(device.lastUsedAt)}` : "Not used yet"}
                  </span>
                </span>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => revoke(device.id, device.label)}>
                  <Trash2 aria-hidden /> Unpair
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pairing ? (
        <div className="notice notice-info" style={{ display: "block" }}>
          <strong>Open this on the till device</strong> (scan the code with its camera, or send it the link). It works once, for 15 minutes.
          <div className="staff-pair-qr" dangerouslySetInnerHTML={{ __html: pairing.qrSvg }} />
          <div className="share-link">
            <code>{pairing.url}</code>
            <CopyButton text={pairing.url} />
          </div>
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginTop: 10 }}
            onClick={() => {
              setPairing(null);
              router.refresh();
            }}
          >
            Done
          </button>
        </div>
      ) : (
        <div className="inline">
          <input className="input" style={{ flex: 1, minWidth: 160 }} aria-label="Device name" value={label} maxLength={40} onChange={(event) => setLabel(event.target.value)} />
          <button type="button" className="btn" onClick={addDevice} disabled={busy || !label.trim()}>
            {busy ? <Loader2 className="spin" aria-hidden /> : <Plus aria-hidden />} Add a staff device
          </button>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Field label="Time between stamps for one card" htmlFor="cooldown" hint="Stops a card being stamped twice by mistake. Staff can still confirm “add another”.">
          <select id="cooldown" className="select" value={cooldown} onChange={(event) => saveCooldown(Number(event.target.value))}>
            {COOLDOWNS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {error && <p className="field-error" style={{ marginTop: 8 }}>{error}</p>}
    </Card>
  );
}
