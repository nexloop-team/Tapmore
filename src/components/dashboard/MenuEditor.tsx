"use client";

import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { VegMark } from "@/components/menu/VegMark";
import { useLivePreview } from "@/lib/live-preview";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { isIndianMenu, menuPriceFormat } from "@/lib/venue/region";
import { ALLERGENS, DIETARY_TAGS, FOOD_TYPES, LINK_LABEL_TOKENS, MENU_BADGES } from "@/lib/venue/constants";
import type { VenueConfig } from "@/lib/venue/schema";
import { useConfirm } from "./confirm";
import { PreviewPane } from "./EditorFrame";
import { MenuAiTools } from "./MenuAiTools";
import { MobilePreview } from "./MobilePreview";
import { Card, Field, ImageField, newClientId, SaveBar, Switch, SwitchRow, TextField } from "./ui";
import { moveTo, useDragReorder } from "./useDragReorder";
import { useVenueDraft } from "./useVenueDraft";

type Menu = VenueConfig["menus"][number];
type Section = Menu["sections"][number];
type Item = Section["items"][number];
type FoodType = (typeof FOOD_TYPES)[number];

const BADGE_LABELS: Record<(typeof MENU_BADGES)[number], string> = { popular: "Popular", new: "New", spicy: "Spicy", chef: "Chef's pick" };
const DIETARY_LABELS: Record<(typeof DIETARY_TAGS)[number], string> = { vegan: "Vegan", vegetarian: "Vegetarian", gluten_free: "Gluten-free" };
const FOOD_TYPE_LABELS: Record<FoodType, string> = { veg: "Veg", nonveg: "Non-veg", egg: "Egg" };
const BUTTON_LABELS: Record<(typeof LINK_LABEL_TOKENS)[number], string> = {
  view_menu: "View menu",
  view_price_list: "View price list",
  our_services: "Our services",
  book_now: "Book now",
  visit_website: "Visit website",
  order_online: "Order online",
};

function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "4.5" or "4,50" → 450; anything else → null. */
function parsePrice(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  return Math.round(parseFloat(clean) * 100);
}

/** What the editor needs to know about the venue's menu conventions. */
interface Conventions {
  money: Intl.NumberFormat;
  symbol: string;
  /** Indian menus: the veg mark and "Bestseller" instead of allergens and dietary tags. */
  indian: boolean;
}

/**
 * The menu, as an owner thinks of it: add a dish with its name and price in
 * one line, flip "In stock" on the row, and open a dish only to add the
 * extras (photo, description, tags). Built like the quick-add in Square and
 * the item list in the Zomato and Swiggy partner apps.
 */
export function MenuEditor({
  venueId,
  menus,
  currencyCode,
  ai,
  importLimits,
  previewUrl,
}: {
  venueId: string;
  /** The hosted menu as guests see it, in preview mode. */
  previewUrl: string;
  menus: VenueConfig["menus"];
  currencyCode: string;
  /** "off": AI isn't configured on this server. */
  ai: "on" | "off";
  importLimits: { maxImages: number; pdf: boolean };
}) {
  // Compiled by the React Compiler (annotation mode, see next.config): re-renders only what an edit touches.
  "use memo";
  const editor = useVenueDraft<{ menus: VenueConfig["menus"] }>(venueId, { menus });
  const ask = useConfirm();
  const list = editor.draft.menus;
  const [selected, setSelected] = useState(0);
  const [importing, setImporting] = useState(false);
  // Imported items whose allergens came from the AI, until the owner opens them.
  const [toCheck, setToCheck] = useState<Set<string>>(() => new Set());
  const menu = list[Math.min(selected, list.length - 1)];
  const conventions = useMemo<Conventions>(() => {
    const money = menuPriceFormat(undefined, currencyCode);
    return { money, symbol: money.formatToParts(0).find((part) => part.type === "currency")?.value ?? "", indian: isIndianMenu(currencyCode) };
  }, [currencyCode]);
  const external = menu ? menu.externalUrl !== null && menu.externalUrl !== undefined : false;
  const dishCount = menu?.sections.reduce((n, s) => n + s.items.length, 0) ?? 0;

  // The preview frame shows the draft, opened on the menu being edited.
  const previewDraft = useMemo(() => ({ menus: list, menuId: menu?.id ?? null }), [list, menu?.id]);
  useLivePreview(previewDraft);

  const setMenus = (next: VenueConfig["menus"]) => editor.update("menus", next);
  const setMenu = (patch: Partial<Menu>) => setMenus(list.map((m) => (m === menu ? { ...m, ...patch } : m)));
  const setSections = (sections: Section[]) => setMenu({ sections: sections.map((s, i) => ({ ...s, sortOrder: i })) });

  function addMenu() {
    setMenus([...list, { id: newClientId("menu"), name: `Menu ${list.length + 1}`, sections: [] }]);
    setSelected(list.length);
  }

  async function removeMenu() {
    if (!menu) return;
    if (!(await ask({ title: `Delete “${menu.name}”?`, body: "Every section and dish on this menu goes too. Nothing is saved until you press Save changes.", confirmLabel: "Delete menu", danger: true }))) return;
    setMenus(list.filter((m) => m !== menu));
    setSelected(0);
  }

  return (
    <div className="editor-grid">
      <div>
        <MobilePreview src={previewUrl} label="Preview your menu" dirty={editor.dirty} />
        <div className="menu-switcher" role="group" aria-label="Menus">
          {list.map((m, index) => (
            <button key={m.id} type="button" className="chip" aria-pressed={m === menu} onClick={() => setSelected(index)}>
              {m.name || "Untitled"}
            </button>
          ))}
          <button type="button" className="chip chip-add" onClick={addMenu} disabled={list.length >= 10}>
            <Plus aria-hidden /> New menu
          </button>
        </div>

        {!menu ? (
          <Card>
            <div className="empty">
              <p>No menus yet.</p>
              <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={addMenu}>
                <Plus aria-hidden /> Create a menu
              </button>
            </div>
          </Card>
        ) : (
          <div className="editor-flow">
            <Card
              title={menu.name || "Menu"}
              description={external ? "Guests who tap the menu card go straight to your own menu page." : `${dishCount} dish${dishCount === 1 ? "" : "es"} in ${menu.sections.length} section${menu.sections.length === 1 ? "" : "s"}.`}
              actions={
                list.length > 1 ? (
                  <button type="button" className="btn btn-sm btn-danger" onClick={removeMenu}>
                    <Trash2 aria-hidden /> Delete menu
                  </button>
                ) : undefined
              }
            >
              <div className="row">
                <TextField label="Menu name" value={menu.name} onChange={(value) => setMenu({ name: value ?? "" })} placeholder="All day" maxLength={80} />
                {!external && (
                  <div className="field">
                    <span className="field-label" id="menu-look-label">
                      Look
                    </span>
                    <div className="segmented" role="group" aria-labelledby="menu-look-label">
                      <button type="button" aria-pressed={menu.layout !== "classic"} onClick={() => setMenu({ layout: null })}>
                        Cards with photos
                      </button>
                      <button type="button" aria-pressed={menu.layout === "classic"} onClick={() => setMenu({ layout: "classic" })}>
                        Classic printed
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {external ? (
                <div className="row" style={{ marginTop: 14 }}>
                  <TextField label="Menu link" value={menu.externalUrl} onChange={(value) => setMenu({ externalUrl: value ?? "" })} placeholder="https://" type="url" />
                  <Field label="Button text" htmlFor="menu-label">
                    <select id="menu-label" className="select" value={menu.linkLabelToken ?? "view_menu"} onChange={(event) => setMenu({ linkLabelToken: event.target.value as Menu["linkLabelToken"] })}>
                      {LINK_LABEL_TOKENS.map((token) => (
                        <option key={token} value={token}>
                          {BUTTON_LABELS[token]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              ) : (
                <>
                  <TextField label="Welcome note (optional)" value={menu.welcomeText} onChange={(value) => setMenu({ welcomeText: value })} placeholder="Food served 12 – 9pm" maxLength={200} />
                  <SwitchRow title="Show calories" description="Print each dish's kcal where you've entered it." checked={!!menu.showCalories} onChange={(on) => setMenu({ showCalories: on })} />
                </>
              )}
              <button
                type="button"
                className="btn btn-sm btn-ghost menu-mode-switch"
                onClick={() => setMenu(external ? { externalUrl: null } : { externalUrl: menu.externalUrl ?? "", linkLabelToken: menu.linkLabelToken ?? "view_menu" })}
              >
                {external ? "Add the dishes here instead" : "My menu is on another website"}
              </button>
            </Card>

            {!external && (
              <>
                {ai !== "off" &&
                  (importing || dishCount === 0 ? (
                    <div className="menu-import">
                      {dishCount > 0 && (
                        <button type="button" className="btn btn-sm btn-ghost menu-import-close" onClick={() => setImporting(false)}>
                          <X aria-hidden /> Close
                        </button>
                      )}
                      <MenuAiTools
                        venueId={venueId}
                        importLimits={importLimits}
                        sections={menu.sections}
                        onImport={(sections, mode, flagged) => {
                          setSections(mode === "replace" ? sections : [...menu.sections, ...sections]);
                          setToCheck((current) => new Set([...current, ...flagged]));
                          setImporting(false);
                        }}
                        onExplanations={(byItemId) =>
                          setSections(
                            menu.sections.map((section) => ({
                              ...section,
                              items: section.items.map((item) => (byItemId[item.id] ? { ...item, explainer: byItemId[item.id] } : item)),
                            })),
                          )
                        }
                      />
                    </div>
                  ) : (
                    <button type="button" className="btn menu-import-open" onClick={() => setImporting(true)}>
                      <Sparkles aria-hidden /> Add dishes from a photo of your menu
                    </button>
                  ))}

                {toCheck.size > 0 && (
                  <div className="notice notice-warn">
                    {toCheck.size} imported dish{toCheck.size === 1 ? " has" : "es have"} AI-suggested allergens. Open each one marked “Check allergens” and confirm before saving.
                  </div>
                )}

                <MenuSections
                  venueId={venueId}
                  ai={ai === "on"}
                  sections={menu.sections}
                  conventions={conventions}
                  toCheck={toCheck}
                  onChecked={(itemId) =>
                    setToCheck((current) => {
                      if (!current.has(itemId)) return current;
                      const next = new Set(current);
                      next.delete(itemId);
                      return next;
                    })
                  }
                  onChange={setSections}
                  onRemoveSection={async (section) =>
                    section.items.length === 0 ||
                    (await ask({
                      title: `Delete “${section.name || "this section"}”?`,
                      body: `Its ${section.items.length} dish${section.items.length === 1 ? "" : "es"} go too.`,
                      confirmLabel: "Delete section",
                      danger: true,
                    }))
                  }
                />
              </>
            )}
          </div>
        )}
      </div>

      {external || !menu ? (
        <aside className="preview-pane" aria-label="Menu preview">
          <span className="preview-label">Live preview</span>
          <div className="preview-empty">
            <p>{menu ? "This menu opens your own link, so there's nothing to preview here." : "Your menu shows here once you add one."}</p>
          </div>
        </aside>
      ) : (
        <PreviewPane src={`${previewUrl}&embed=1`} title="Live menu preview" fullHref={previewUrl} />
      )}

      <SaveBar dirty={editor.dirty} saving={editor.saving} error={editor.error} onSave={editor.save} onReset={editor.reset} />
    </div>
  );
}

/** One line under a dish's name: what a guest will see on it, or what still needs doing. */
function itemNote(item: Item, flagged: boolean, indian: boolean): { text: string; warn: boolean } {
  if (flagged) return { text: "Imported · check allergens", warn: true };
  if (!item.priceInPence) return { text: "No price yet", warn: true };
  if (indian && !item.foodType) return { text: "Mark it veg or non-veg", warn: true };
  const parts = [
    ...(item.badges ?? []).map((badge) => (indian && badge === "popular" ? "Bestseller" : BADGE_LABELS[badge])),
    ...(indian ? [] : item.dietaryTags.map((tag) => DIETARY_LABELS[tag])),
    ...(item.featured ? ["Today's special"] : []),
  ];
  return { text: parts.join(" · ") || item.description || "Tap to add a photo, description or tags", warn: false };
}

interface SectionsProps {
  venueId: string;
  ai: boolean;
  sections: Section[];
  conventions: Conventions;
  toCheck: Set<string>;
  onChecked: (itemId: string) => void;
  onChange: (sections: Section[]) => void;
  /** Resolves true once the owner has confirmed (or there was nothing to lose). */
  onRemoveSection: (section: Section) => Promise<boolean>;
}

/** Every section stacked, as guests see the menu; a dish opens in place to edit, one at a time. */
function MenuSections({ sections, onChange, onRemoveSection, ...rest }: SectionsProps) {
  const [openItem, setOpenItem] = useState<string | null>(null);

  function addSection() {
    onChange([...sections, { id: newClientId("sec"), name: "", sortOrder: sections.length, items: [] }]);
  }

  return (
    <>
      {sections.map((section, index) => (
        <SectionCard
          key={section.id}
          {...rest}
          section={section}
          first={index === 0}
          last={index === sections.length - 1}
          openItem={openItem}
          onOpen={setOpenItem}
          onChange={(next) => onChange(sections.map((s) => (s.id === next.id ? next : s)))}
          onMove={(delta) => onChange(move(sections, index, delta))}
          onRemove={async () => {
            if (await onRemoveSection(section)) onChange(sections.filter((s) => s.id !== section.id));
          }}
        />
      ))}
      <button type="button" className="btn-dashed" disabled={sections.length >= 50} onClick={addSection}>
        <Plus aria-hidden /> {sections.length === 0 ? "Add your first section, like Starters or Coffee" : "Add a section"}
      </button>
    </>
  );
}

function SectionCard({
  venueId,
  ai,
  section,
  first,
  last,
  conventions,
  toCheck,
  openItem,
  onOpen,
  onChecked,
  onChange,
  onMove,
  onRemove,
}: Omit<SectionsProps, "sections" | "onChange" | "onRemoveSection"> & {
  section: Section;
  first: boolean;
  last: boolean;
  openItem: string | null;
  onOpen: (itemId: string | null) => void;
  onChange: (section: Section) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const { money, indian } = conventions;
  const setItems = (items: Item[]) => onChange({ ...section, items });
  const setItem = (id: string, patch: Partial<Item>) => setItems(section.items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const drag = useDragReorder(section.items.length, (from, to) => setItems(moveTo(section.items, from, to)));

  return (
    <section className="card menu-section-card" aria-label={section.name || "New section"}>
      <div className="pane-head">
        <input className="input pane-title" aria-label="Section name" placeholder="Section name, e.g. Starters" value={section.name} maxLength={120} onChange={(event) => onChange({ ...section, name: event.target.value })} />
        <button type="button" className="btn btn-icon btn-ghost" aria-label="Move section up" disabled={first} onClick={() => onMove(-1)}>
          <ArrowUp aria-hidden />
        </button>
        <button type="button" className="btn btn-icon btn-ghost" aria-label="Move section down" disabled={last} onClick={() => onMove(1)}>
          <ArrowDown aria-hidden />
        </button>
        <button type="button" className="btn btn-icon btn-ghost" aria-label="Delete section" onClick={onRemove}>
          <Trash2 aria-hidden />
        </button>
      </div>
      <input
        className="input pane-desc"
        aria-label="Section note"
        placeholder="Optional note, e.g. Served until 11:30"
        value={section.description ?? ""}
        maxLength={140}
        onChange={(event) => onChange({ ...section, description: event.target.value || null })}
      />
      {section.items.length > 0 && (
        <ul className="pane-list">
          {section.items.map((it, index) => {
            const note = itemNote(it, toCheck.has(it.id), indian);
            const open = openItem === it.id;
            return (
              <li key={it.id} ref={drag.rowRef(index)} className={`item-row${open ? " selected" : ""}${it.isAvailable ? "" : " sold-out"}${drag.dragging === index ? " dragging" : ""}`}>
                <button type="button" className="drag-handle" aria-label={`Reorder ${it.name || "this dish"}. Use the arrow keys to move it.`} {...drag.handleProps(index)}>
                  <GripVertical aria-hidden />
                </button>
                <button type="button" className="item-row-main" aria-expanded={open} onClick={() => onOpen(open ? null : it.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- merchant uploads, already sized */}
                  {it.imageUrl && <img className="item-thumb" src={it.imageUrl} alt="" />}
                  <span className="item-row-text">
                    <strong>
                      {indian && it.foodType && <VegMark type={it.foodType} label={FOOD_TYPE_LABELS[it.foodType]} />}
                      {it.name || "Untitled dish"}
                    </strong>
                    <span className={note.warn ? "warn" : undefined}>{note.text}</span>
                  </span>
                  <span className="num item-row-price">{money.format(it.priceInPence / 100)}</span>
                  <ChevronDown className="item-row-chevron" aria-hidden />
                </button>
                <span className="item-row-stock">
                  <span aria-hidden>{it.isAvailable ? "In stock" : "Sold out"}</span>
                  <Switch label={`${it.name || "This dish"} in stock`} checked={it.isAvailable} onChange={(on) => setItem(it.id, { isAvailable: on })} />
                </span>
                {open && (
                  <ItemEditor
                    venueId={venueId}
                    ai={ai}
                    item={it}
                    conventions={conventions}
                    flagged={toCheck.has(it.id)}
                    onChecked={() => onChecked(it.id)}
                    onChange={(next) => setItems(section.items.map((i) => (i.id === it.id ? next : i)))}
                    onRemove={() => {
                      setItems(section.items.filter((i) => i.id !== it.id));
                      onOpen(null);
                    }}
                    onClose={() => onOpen(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {section.items.length < 300 && <QuickAdd conventions={conventions} onAdd={(item) => setItems([...section.items, item])} />}
    </section>
  );
}

/** One line to add a dish: name, price (and veg or non-veg), Enter. Details can come later. */
function QuickAdd({ conventions, onAdd }: { conventions: Conventions; onAdd: (item: Item) => void }) {
  const { symbol, indian } = conventions;
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [foodType, setFoodType] = useState<FoodType>("veg");
  const nameInput = useRef<HTMLInputElement>(null);
  const pence = price.trim() ? parsePrice(price) : 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || pence === null) return;
    onAdd({ id: newClientId("itm"), name: name.trim().slice(0, 120), priceInPence: pence, isAvailable: true, allergens: [], dietaryTags: [], ...(indian ? { foodType } : {}) });
    setName("");
    setPrice("");
    nameInput.current?.focus();
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <input ref={nameInput} className="input" aria-label="New dish name" placeholder={indian ? "Add a dish, e.g. Masala dosa" : "Add a dish, e.g. Flat white"} value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
      <span className="input-prefix quick-add-price">
        {symbol && <span aria-hidden>{symbol}</span>}
        <input className="input" aria-label="Price" inputMode="decimal" placeholder="0" value={price} onChange={(event) => setPrice(event.target.value)} aria-invalid={pence === null} />
      </span>
      {indian && (
        <span className="segmented quick-add-type" role="group" aria-label="Veg or non-veg">
          {(["veg", "nonveg"] as const).map((type) => (
            <button key={type} type="button" aria-pressed={foodType === type} onClick={() => setFoodType(type)}>
              <VegMark type={type} label="" />
              {FOOD_TYPE_LABELS[type]}
            </button>
          ))}
        </span>
      )}
      <button type="submit" className="btn btn-primary" disabled={!name.trim() || pence === null}>
        <Plus aria-hidden /> Add
      </button>
    </form>
  );
}

function ItemEditor({
  venueId,
  ai,
  item,
  conventions,
  flagged,
  onChecked,
  onChange,
  onRemove,
  onClose,
}: {
  venueId: string;
  ai: boolean;
  item: Item;
  conventions: Conventions;
  /** Allergens came from an AI import and haven't been confirmed yet. */
  flagged: boolean;
  onChecked: () => void;
  onChange: (item: Item) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { symbol, indian } = conventions;
  // Typed text, so "4." or "" survive while the owner is mid-edit.
  const [price, setPrice] = useState(item.priceInPence ? String(item.priceInPence / 100) : "");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [aiDrafted, setAiDrafted] = useState(false);
  // The rarely used settings stay folded unless the dish already uses one.
  const [more, setMore] = useState(flagged || !!item.calories || !!item.featured || !!item.explainer || (!indian && item.allergens.length > 0));
  const set = (patch: Partial<Item>) => onChange({ ...item, ...patch });
  const toggle = <T extends string>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <div className="item-editor" role="group" aria-label={`Edit ${item.name || "new dish"}`}>
      {flagged && (
        <div className="ai-check">
          <span>
            <strong>Allergens suggested by AI.</strong> Check they&apos;re right for your kitchen before saving.
          </span>
          <button type="button" className="btn btn-sm" onClick={onChecked}>
            Looks right
          </button>
        </div>
      )}

      <div className="row">
        <TextField label="Name" value={item.name} onChange={(value) => set({ name: value ?? "" })} maxLength={120} />
        <Field label="Price" htmlFor={`price-${item.id}`}>
          <span className="input-prefix">
            {symbol && <span aria-hidden>{symbol}</span>}
            <input
              id={`price-${item.id}`}
              className="input"
              inputMode="decimal"
              placeholder="0"
              value={price}
              onChange={(event) => {
                const text = event.target.value.replace(",", ".");
                if (!/^\d*\.?\d{0,2}$/.test(text)) return;
                setPrice(text);
                set({ priceInPence: Math.round((parseFloat(text) || 0) * 100) });
              }}
            />
          </span>
        </Field>
      </div>

      {indian && (
        <div className="field">
          <span className="field-label" id={`type-${item.id}`}>
            Veg or non-veg
          </span>
          <div className="segmented" role="group" aria-labelledby={`type-${item.id}`}>
            {FOOD_TYPES.map((type) => (
              <button key={type} type="button" aria-pressed={item.foodType === type} onClick={() => set({ foodType: type })}>
                <VegMark type={type} label="" />
                {FOOD_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      )}

      <TextField label="Description (optional)" value={item.description} onChange={(value) => set({ description: value })} multiline maxLength={500} placeholder="What's in it, in a line or two" />
      <ImageField venueId={venueId} kind="dish" label="Photo (optional)" value={item.imageUrl} onChange={(url) => set({ imageUrl: url })} />

      <div className="field">
        <span className="field-label">Tags</span>
        <div className="chips">
          {MENU_BADGES.map((badge) => (
            <button key={badge} type="button" className="chip" aria-pressed={(item.badges ?? []).includes(badge)} onClick={() => set({ badges: toggle(item.badges ?? [], badge) })}>
              {indian && badge === "popular" ? "Bestseller" : BADGE_LABELS[badge]}
            </button>
          ))}
          {!indian &&
            DIETARY_TAGS.map((tag) => (
              <button key={tag} type="button" className="chip" aria-pressed={item.dietaryTags.includes(tag)} onClick={() => set({ dietaryTags: toggle(item.dietaryTags, tag) })}>
                {DIETARY_LABELS[tag]}
              </button>
            ))}
        </div>
      </div>

      <details className="more-options" open={more} onToggle={(event) => setMore(event.currentTarget.open)}>
        <summary>More options</summary>
        <div className="more-options-body">
          <div className="switch-list">
            <SwitchRow title="Today's special" description="Shows in the specials strip at the top of the menu." checked={!!item.featured} onChange={(on) => set({ featured: on })} />
          </div>
          <Field label="Calories" htmlFor={`kcal-${item.id}`} hint="Shown when “Show calories” is on for this menu.">
            <span className="input-prefix suffix" style={{ maxWidth: 200 }}>
              <input
                id={`kcal-${item.id}`}
                className="input"
                inputMode="numeric"
                placeholder="0"
                value={item.calories ?? ""}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "").slice(0, 5);
                  set({ calories: digits ? Number(digits) : null });
                }}
              />
              <span aria-hidden>kcal</span>
            </span>
          </Field>

          {!indian && (
            <div className="field">
              <span className="field-label">Allergens</span>
              <div className="chips">
                {ALLERGENS.map((allergen) => (
                  <button key={allergen} type="button" className="chip" aria-pressed={item.allergens.includes(allergen)} onClick={() => set({ allergens: toggle(item.allergens, allergen) })}>
                    {capitalise(allergen)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <div className="spread">
              <label htmlFor={`explainer-${item.id}`}>“What&apos;s this?” note</label>
              {ai && (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={drafting || !item.name.trim()}
                  onClick={async () => {
                    setDrafting(true);
                    setDraftError(null);
                    try {
                      const { suggestions } = await dashboardApi.explainDishes(venueId, {
                        items: [{ id: item.id, name: item.name, description: item.description ?? null }],
                        onlyUnfamiliar: false,
                      });
                      if (suggestions[0]) {
                        set({ explainer: suggestions[0].explainer });
                        setAiDrafted(true);
                      } else setDraftError("No draft came back. Try adding a short description first.");
                    } catch (err) {
                      setDraftError(errorMessage(err));
                    } finally {
                      setDrafting(false);
                    }
                  }}
                >
                  {drafting ? <Loader2 className="spin" aria-hidden /> : <Sparkles aria-hidden />} {item.explainer ? "Redraft with AI" : "Draft with AI"}
                </button>
              )}
            </div>
            <textarea
              id={`explainer-${item.id}`}
              className={`textarea${aiDrafted ? " ai-drafted" : ""}`}
              maxLength={600}
              value={item.explainer ?? ""}
              placeholder="For dishes guests might not know, e.g. “Shakshuka is eggs gently poached in a spiced tomato and pepper sauce…”"
              onChange={(event) => set({ explainer: event.target.value || null })}
            />
            {draftError ? (
              <p className="field-error">{draftError}</p>
            ) : aiDrafted ? (
              <div className="ai-check">
                <span>
                  <strong>AI draft.</strong> Check it&apos;s right for your kitchen before saving.
                </span>
                <button type="button" className="btn btn-sm" onClick={() => setAiDrafted(false)}>
                  Looks right
                </button>
              </div>
            ) : (
              <p className="hint">Guests tap “What&apos;s this?” under the dish to read it. Leave blank for familiar dishes.</p>
            )}
          </div>
        </div>
      </details>

      <div className="item-editor-foot">
        <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={onRemove}>
          <Trash2 aria-hidden /> Delete dish
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
