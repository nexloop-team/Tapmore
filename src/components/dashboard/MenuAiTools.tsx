"use client";

import { FileUp, Loader2, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { compressImage } from "@/lib/browser";
import type { BusinessProfile } from "@/lib/venue/business";
import type { VenueConfig } from "@/lib/venue/schema";
import { useConfirm } from "./confirm";

type Section = VenueConfig["menus"][number]["sections"][number];

/**
 * AI helpers above the hosted menu: read a printed menu into sections, and
 * draft "What's this?" notes for unfamiliar dishes. Both produce drafts the
 * owner reviews here and then saves with the normal save bar.
 */
/** Big enough to read small menu print, small enough for every provider's upload limit. */
export async function shrinkForUpload(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;
  try {
    const { base64 } = await compressImage(file, 2000, 0.85);
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new File([bytes], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function MenuAiTools({
  venueId,
  words,
  importLimits,
  sections,
  onImport,
  onExplanations,
}: {
  venueId: string;
  /** The business's words and whether it's food (only food gets "Explain unusual dishes"). */
  words: BusinessProfile;
  /** What the server's AI provider can read: some take PDFs and more photos than others. */
  importLimits: { maxImages: number; pdf: boolean };
  sections: Section[];
  onImport: (sections: Section[], mode: "add" | "replace", flaggedItemIds: string[]) => void;
  onExplanations: (byItemId: Record<string, string>) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const ask = useConfirm();
  const [busy, setBusy] = useState<"import" | "explain" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<{ sections: Section[]; flaggedItemIds: string[] } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [drafts, setDrafts] = useState<{ itemId: string; name: string; explainer: string; keep: boolean }[] | null>(null);

  const items = sections.flatMap((section) => section.items);
  const unexplained = items.filter((item) => item.name.trim() && !item.explainer);

  const intro = (
    <div className="ai-intro">
      <span className="ai-icon" aria-hidden>
        <Sparkles />
      </span>
      <div>
        <strong className="ai-title">
          Import from a photo{importLimits.pdf ? " or PDF" : ""}
        </strong>
        <p>
          Snap your printed {words.foodFields ? "menu" : "price list or board"}. We&apos;ll read the {words.items} and prices, and you check them before anything goes live.
        </p>
      </div>
    </div>
  );

  async function runImport(files: File[]) {
    setError(null);
    setImported(null);
    if (files.length > importLimits.maxImages) {
      setError(`Choose up to ${importLimits.maxImages} photos at a time. Import the rest in a second go.`);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (!importLimits.pdf && files.some((file) => file.type === "application/pdf")) {
      setError("PDFs can't be read right now. Take a photo or screenshot of each page instead.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setBusy("import");
    try {
      setImported(await dashboardApi.importMenu(venueId, await Promise.all(files.map(shrinkForUpload))));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function runExplain() {
    setBusy("explain");
    setError(null);
    setDrafts(null);
    try {
      const { suggestions } = await dashboardApi.explainDishes(venueId, {
        items: unexplained.slice(0, 150).map((item) => ({ id: item.id, name: item.name, description: item.description ?? null })),
        onlyUnfamiliar: true,
      });
      const names = new Map(items.map((item) => [item.id, item.name]));
      setDrafts(suggestions.map((s) => ({ ...s, name: names.get(s.itemId) ?? "", keep: true })));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const importedCount = imported?.sections.reduce((n, s) => n + s.items.length, 0) ?? 0;

  return (
    <section className="card ai-card">
      {intro}
      <div
        className={`ai-drop${dragging ? " dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const files = Array.from(event.dataTransfer.files);
          if (files.length && !busy) void runImport(files);
        }}
      >
        {busy === "import" ? (
          <>
            <div className="spread">
              <strong>Reading your {words.foodFields ? "menu" : "price list"}…</strong>
              <Loader2 className="spin" aria-hidden />
            </div>
            <div className="progress indeterminate" role="progressbar" aria-label="Reading the photo">
              <div />
            </div>
            <span className="hint">This usually takes under a minute. Keep this page open.</span>
          </>
        ) : (
          <>
            <button type="button" className="btn" disabled={!!busy} onClick={() => fileInput.current?.click()}>
              <FileUp aria-hidden /> {importLimits.pdf ? "Choose photos or a PDF" : "Choose photos"}
            </button>
            <span className="hint">
              Or drop them here. Up to {importLimits.maxImages} clear, straight-on photos per import{importLimits.pdf ? ", or one PDF" : ""}.
            </span>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          accept={importLimits.pdf ? "image/jpeg,image/png,image/webp,image/gif,application/pdf" : "image/jpeg,image/png,image/webp,image/gif"}
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length) void runImport(files);
          }}
        />
      </div>
      <div className="ai-explain">
        <span className="hint">Drafts only: nothing reaches {words.people} until you review it and save.</span>
        {words.foodFields && (
          <button type="button" className="btn btn-sm" disabled={!!busy || unexplained.length === 0} onClick={runExplain}>
            {busy === "explain" ? <Loader2 className="spin" aria-hidden /> : <Sparkles aria-hidden />}
            {busy === "explain" ? "Thinking…" : "Explain unusual dishes"}
          </button>
        )}
      </div>
      {error && <p className="field-error ai-wide">{error}</p>}

      {imported && (
        <div className="notice notice-info" style={{ display: "block", marginTop: 14 }}>
          <strong>
            Found {importedCount} {importedCount === 1 ? words.item : words.items} in {imported.sections.length} section{imported.sections.length === 1 ? "" : "s"}:
          </strong>{" "}
          {imported.sections.map((s) => `${s.name} (${s.items.length})`).join(", ")}.
          {imported.flaggedItemIds.length > 0 && (
            <p style={{ marginTop: 6 }}>
              {imported.flaggedItemIds.length} {imported.flaggedItemIds.length === 1 ? `${words.item} has` : `${words.items} have`} suggested allergens, marked <span className="badge badge-warn">Check allergens</span>. Please check each one before saving.
            </p>
          )}
          <div className="inline" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                onImport(imported.sections, "add", imported.flaggedItemIds);
                setImported(null);
              }}
            >
              Add to this list
            </button>
            {sections.length > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={async () => {
                  if (!(await ask({ title: `Replace this ${words.catalogue.toLowerCase()}?`, body: "Every section is swapped for the imported ones.", confirmLabel: "Replace", danger: true }))) return;
                  onImport(imported.sections, "replace", imported.flaggedItemIds);
                  setImported(null);
                }}
              >
                Replace everything
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImported(null)}>
              Discard
            </button>
          </div>
        </div>
      )}

      {drafts && (
        <div className="notice notice-info" style={{ display: "block", marginTop: 14 }}>
          {drafts.length === 0 ? (
            <>
              <strong>Nothing to explain.</strong> Your dish names look familiar enough. You can still write a note on any dish yourself.
              <div style={{ marginTop: 10 }}>
                <button type="button" className="btn btn-sm" onClick={() => setDrafts(null)}>
                  OK
                </button>
              </div>
            </>
          ) : (
            <>
              <strong>Review the drafts.</strong> Edit anything that doesn&apos;t match how you make it.
              <div className="stack" style={{ marginTop: 10 }}>
                {drafts.map((draft, index) => (
                  <div key={draft.itemId} className="list-row">
                    <label className="inline" style={{ fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={draft.keep}
                        onChange={(event) => setDrafts(drafts.map((d, i) => (i === index ? { ...d, keep: event.target.checked } : d)))}
                      />
                      {draft.name}
                    </label>
                    <textarea
                      className="textarea"
                      style={{ marginTop: 6 }}
                      aria-label={`What's this: ${draft.name}`}
                      value={draft.explainer}
                      maxLength={600}
                      onChange={(event) => setDrafts(drafts.map((d, i) => (i === index ? { ...d, explainer: event.target.value } : d)))}
                    />
                  </div>
                ))}
              </div>
              <div className="inline" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!drafts.some((d) => d.keep && d.explainer.trim())}
                  onClick={() => {
                    onExplanations(Object.fromEntries(drafts.filter((d) => d.keep && d.explainer.trim()).map((d) => [d.itemId, d.explainer.trim()])));
                    setDrafts(null);
                  }}
                >
                  Add {drafts.filter((d) => d.keep).length} note{drafts.filter((d) => d.keep).length === 1 ? "" : "s"}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDrafts(null)}>
                  Discard
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
