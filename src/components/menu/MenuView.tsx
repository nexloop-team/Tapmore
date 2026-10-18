"use client";

import { ChefHat, ChevronLeft, Flame, Info, Leaf, Menu as MenuLines, Search, Sparkles, Sprout, Star, WheatOff, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { scrollMotion } from "@/lib/browser";
import { createTracker } from "@/lib/analytics";
import { createTranslator, type Locale, type MessageKey } from "@/lib/i18n";
import { usePreviewDraft } from "@/lib/live-preview";
import { computeTheme } from "@/lib/theme";
import { safeImageUrl } from "@/lib/venue/features";
import type { Menu, MenuItem, VenueBranding } from "@/lib/venue/types";
import { ALLERGENS } from "@/lib/venue/constants";
import { isIndianMenu, menuPriceFormat } from "@/lib/venue/region";
import { DishSheet } from "./DishSheet";
import { MenuBrowseSheet } from "./MenuBrowseSheet";
import { VegMark } from "./VegMark";

type Badge = NonNullable<MenuItem["badges"]>[number];

const BADGES: Record<Badge, { key: MessageKey; icon: LucideIcon }> = {
  popular: { key: "badge_popular", icon: Star },
  new: { key: "badge_new", icon: Sparkles },
  spicy: { key: "badge_spicy", icon: Flame },
  chef: { key: "badge_chef", icon: ChefHat },
};

const DIETS: Record<string, { key: MessageKey; icon: LucideIcon }> = {
  vegan: { key: "dietary_vegan", icon: Leaf },
  vegetarian: { key: "dietary_vegetarian", icon: Sprout },
  gluten_free: { key: "dietary_gluten_free", icon: WheatOff },
};

const FOOD_TYPE_KEYS: Record<NonNullable<MenuItem["foodType"]>, MessageKey> = { veg: "food_veg", nonveg: "food_nonveg", egg: "food_egg" };

/** Indian menus filter on the food mark: one of these at a time. */
const FOOD_FILTERS: string[] = ["veg", "nonveg", "egg"];

/** Filter chips offered when at least one dish carries the tag, in this order. */
const DIET_FILTERS = ["vegan", "vegetarian", "gluten_free"] as const;

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "Gluten-free", "gluten_free" and "GLUTEN FREE" are the same tag. */
function dietKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function priceFormatter(locale: string, currency: string): (pence: number) => string {
  try {
    const format = menuPriceFormat(locale, currency);
    return (pence) => format.format(pence / 100);
  } catch {
    return (pence) => (pence / 100).toFixed(2);
  }
}

function matches(item: MenuItem, query: string): boolean {
  if (!query) return true;
  return `${item.name} ${item.description ?? ""}`.toLowerCase().includes(query);
}

/** Vegan dishes count as vegetarian too. */
function fitsDiets(item: MenuItem, diets: string[]): boolean {
  if (diets.length === 0) return true;
  const tags = item.dietaryTags.map(dietKey);
  return diets.every((diet) => (FOOD_FILTERS.includes(diet) ? item.foodType === diet : tags.includes(diet) || (diet === "vegetarian" && tags.includes("vegan"))));
}

interface MenuViewProps {
  venueId: string;
  venueName: string;
  branding: VenueBranding;
  currencyCode: string;
  menus: Menu[];
  locale: Locale;
  source: string;
  backHref: string;
  /** Opened by the venue's own team (signed in): not counted as a guest visit. */
  team?: boolean;
}

/** What the menu editor sends its preview frame: the unsaved menus, opened on the one being edited. */
interface MenuDraft {
  menus: Menu[];
  menuId: string | null;
}

export function MenuView({ venueId, venueName, branding, currencyCode, menus: savedMenus, locale, source, backHref, team = false }: MenuViewProps) {
  const draft = usePreviewDraft<MenuDraft>(source === "preview");
  // Only hosted menus with dishes, the same rule the page applies to saved menus.
  const menus = useMemo(() => (draft ? draft.menus.filter((m) => !m.externalUrl && m.sections.some((s) => s.items.length > 0)) : savedMenus), [draft, savedMenus]);
  const { t, tf } = useMemo(() => createTranslator(locale), [locale]);
  const track = useMemo(() => createTracker({ venueId, source, page: "menu", team }), [venueId, source, team]);
  const formatPrice = useMemo(() => priceFormatter(locale, currencyCode), [locale, currencyCode]);
  const style = useMemo(() => computeTheme(branding).style, [branding]);
  const [menuIndex, setMenuIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [browseOpen, setBrowseOpen] = useState(false);
  const closeBrowse = useCallback(() => setBrowseOpen(false), []);
  const [openDish, setOpenDish] = useState<MenuItem | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const closeDish = useCallback(() => setOpenDish(null), []);

  const focused = draft?.menuId ? menus.findIndex((m) => m.id === draft.menuId) : -1;
  const shownIndex = focused >= 0 ? focused : Math.min(menuIndex, Math.max(0, menus.length - 1));
  const menu = menus[shownIndex] ?? null;
  const sections = useMemo(() => (menu ? [...menu.sections].sort((a, b) => a.sortOrder - b.sortOrder).filter((s) => s.items.length > 0) : []), [menu]);
  const indian = isIndianMenu(currencyCode);
  // Indian menus skip the 14 allergens and filter on the veg mark instead.
  const allergens = useMemo(() => (indian ? [] : [...new Set(sections.flatMap((s) => s.items.flatMap((i) => i.allergens.map((a) => a.toLowerCase()))))].sort()), [sections, indian]);
  const dietOptions = useMemo<string[]>(() => {
    const items = sections.flatMap((s) => s.items);
    if (indian) {
      const present = FOOD_FILTERS.filter((type) => items.some((i) => i.foodType === type));
      return present.length > 1 ? present : [];
    }
    const present = new Set(items.flatMap((i) => i.dietaryTags.map(dietKey)));
    return DIET_FILTERS.filter((diet) => present.has(diet) || (diet === "vegetarian" && present.has("vegan")));
  }, [sections, indian]);
  /** "Bestseller" on Indian menus, as on the delivery apps. */
  const badgeLabel = (badge: Badge) => (indian && badge === "popular" ? t("badge_bestseller") : t(BADGES[badge].key));
  const vegMark = (item: MenuItem) => (indian && item.foodType ? <VegMark type={item.foodType} label={t(FOOD_TYPE_KEYS[item.foodType])} /> : null);

  useEffect(() => {
    track("menu_viewed", { menus: menus.length });
  }, [track, menus.length]);

  const needle = query.trim().toLowerCase();

  const { visibleSections, hiddenByFilter } = useMemo(() => {
    const isFiltered = (item: MenuItem) => item.allergens.some((a) => excluded.includes(a.toLowerCase())) || !fitsDiets(item, diets);
    const searched = sections.map((section) => ({ ...section, items: section.items.filter((item) => matches(item, needle)) }));
    return {
      visibleSections: searched.map((section) => ({ ...section, items: section.items.filter((item) => !isFiltered(item)) })).filter((section) => section.items.length > 0),
      hiddenByFilter: searched.reduce((count, section) => count + section.items.filter(isFiltered).length, 0),
    };
  }, [sections, needle, excluded, diets]);

  /** Today's specials, or the most popular dishes when nothing is marked special. Both respect the filters. */
  const highlights = useMemo(() => {
    const allowed = (item: MenuItem) => item.isAvailable && !item.allergens.some((a) => excluded.includes(a.toLowerCase())) && fitsDiets(item, diets);
    const all = sections.flatMap((s) => s.items).filter(allowed);
    const specials = all.filter((item) => item.featured);
    if (specials.length > 0) return { title: t("menu_specials"), items: specials };
    return { title: t(indian ? "menu_bestsellers" : "menu_popular"), items: all.filter((item) => item.badges?.includes("popular")) };
  }, [sections, excluded, diets, t, indian]);

  // Highlight the section chip for whichever section is at the top of the screen.
  useEffect(() => {
    const elements = visibleSections.map((s) => document.getElementById(`section-${s.id}`)).filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveSection(top.target.id.replace(/^section-/, ""));
      },
      { rootMargin: "-64px 0px -65% 0px" },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visibleSections]);

  function toggleAllergen(allergen: string) {
    const next = excluded.includes(allergen) ? excluded.filter((a) => a !== allergen) : [...excluded, allergen];
    setExcluded(next);
    track("menu_allergen_filter_changed", { excluded: next.join(",") });
  }

  function toggleDiet(diet: string) {
    const next = diets.includes(diet) ? diets.filter((d) => d !== diet) : FOOD_FILTERS.includes(diet) ? [diet] : [...diets, diet];
    setDiets(next);
    track("menu_diet_filter_changed", { diets: next.join(",") });
  }

  function showDish(item: MenuItem, from: string) {
    setOpenDish(item);
    track("menu_item_opened", { item_id: item.id, from, has_explainer: !!item.explainer?.trim() });
  }

  function jumpTo(sectionId: string) {
    document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: scrollMotion(), block: "start" });
    setActiveSection(sectionId);
    track("menu_section_jump", { section_id: sectionId });
  }

  /** Badges, dietary tags and kcal for a dish, in the card colours. */
  function tagList(item: MenuItem) {
    const showKcal = !!menu?.showCalories && typeof item.calories === "number";
    const dietaryTags = indian ? [] : item.dietaryTags;
    if (!(item.badges ?? []).length && !dietaryTags.length && !showKcal) return null;
    return (
      <span className="menu-tags">
        {(item.badges ?? []).map((badge) => {
          const Icon = BADGES[badge].icon;
          return (
            <span key={badge} className={`menu-tag badge ${badge}`}>
              <Icon aria-hidden />
              {badgeLabel(badge)}
            </span>
          );
        })}
        {dietaryTags.map((tag) => {
          const diet = DIETS[dietKey(tag)];
          const Icon = diet?.icon;
          return (
            <span key={tag} className={`menu-tag diet ${dietKey(tag)}`}>
              {Icon && <Icon aria-hidden />}
              {diet ? t(diet.key) : titleCase(tag)}
            </span>
          );
        })}
        {showKcal && <span className="menu-tag kcal">{tf("menu_kcal", { kcal: item.calories as number })}</span>}
      </span>
    );
  }

  /** "Contains: …" plus the reassurance that the rest of the 14 major allergens aren't in it. */
  function allergenLines(item: MenuItem): string[] {
    const listed = item.allergens.filter((allergen) => (ALLERGENS as readonly string[]).includes(allergen.toLowerCase())).length;
    if (item.allergens.length === 0) return [t("menu_no_allergens")];
    return [tf("menu_contains", { allergens: item.allergens.map(titleCase).join(", ") }), tf("menu_allergens_rest", { count: ALLERGENS.length - listed })];
  }

  const current = activeSection ?? visibleSections[0]?.id ?? null;
  // Two looks: the card list (also what the retired "photo" layout shows) and the printed classic.
  const layout = menu?.layout === "classic" ? "classic" : "list";

  /** The dish's labels, as small coloured text over its name: badges first, then (outside India) dietary tags. */
  function labels(item: MenuItem): { key: string; label: string; icon: LucideIcon }[] {
    const badges = (item.badges ?? []).map((badge) => ({ key: badge, label: badgeLabel(badge), icon: BADGES[badge].icon }));
    const diets = indian ? [] : item.dietaryTags.map(dietKey).filter((tag) => DIETS[tag]).map((tag) => ({ key: tag, label: t(DIETS[tag].key), icon: DIETS[tag].icon }));
    return [...badges, ...diets].slice(0, 2);
  }

  /**
   * List layout, the way food apps do it: a row per dish with the words on
   * the left (labels, name, price, two lines of description) and the photo
   * on the right, rows split by a hairline rather than boxed in cards.
   */
  function dishRow(item: MenuItem) {
    const image = safeImageUrl(item.imageUrl);
    const showKcal = !!menu?.showCalories && typeof item.calories === "number";
    const tags = labels(item);
    const mark = vegMark(item);
    return (
      <li key={item.id} id={`item-${item.id}`} className={`dish${item.isAvailable ? "" : " unavailable"}`}>
        <button type="button" className="dish-open" aria-haspopup="dialog" onClick={() => showDish(item, "list")}>
          <span className="dish-body">
            {(mark || tags.length > 0) && (
              <span className="dish-top">
                {mark}
                {tags.map(({ key, label, icon: Icon }) => (
                  <span key={key} className={`dish-label ${key}`}>
                    <Icon aria-hidden />
                    {label}
                  </span>
                ))}
              </span>
            )}
            <span className="dish-name">{item.name}</span>
            <span className="dish-price-line">
              {item.isAvailable ? <span className="dish-price">{formatPrice(item.priceInPence)}</span> : <span className="dish-sold-out">{t("menu_unavailable")}</span>}
              {showKcal && <span className="dish-kcal">{tf("menu_kcal", { kcal: item.calories as number })}</span>}
            </span>
            {item.description && <span className="dish-desc">{item.description}</span>}
            {item.explainer?.trim() && (
              <span className="dish-whats">
                <Info aria-hidden />
                {t("menu_whats_this")}
              </span>
            )}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- merchant image on any host */}
          {image && <img className="dish-photo" src={image} alt="" loading="lazy" />}
        </button>
      </li>
    );
  }

  /**
   * Classic layout, like a printed menu: the name, a dotted leader to the
   * price, the description in italics, and one quiet line of details. No
   * photos, chips or boxes.
   */
  function classicItem(item: MenuItem) {
    const showKcal = !!menu?.showCalories && typeof item.calories === "number";
    const details = [
      ...(item.badges ?? []).map(badgeLabel),
      ...(indian ? [] : item.dietaryTags.map(dietKey).filter((tag) => DIETS[tag]).map((tag) => t(DIETS[tag].key))),
      ...(showKcal ? [tf("menu_kcal", { kcal: item.calories as number })] : []),
      ...(!indian && item.allergens.length > 0 ? [tf("menu_contains", { allergens: item.allergens.map(titleCase).join(", ") })] : []),
    ];
    const explainer = !!item.explainer?.trim();
    return (
      <li key={item.id} id={`item-${item.id}`} className={`classic-item${item.isAvailable ? "" : " unavailable"}`}>
        <button type="button" className="classic-open" aria-haspopup="dialog" onClick={() => showDish(item, "list")}>
          <span className="classic-line">
            <span className="classic-name">
              {vegMark(item)}
              {item.name}
            </span>
            <span className="classic-leader" aria-hidden />
            <span className="classic-price">{item.isAvailable ? formatPrice(item.priceInPence) : t("menu_unavailable")}</span>
          </span>
          {item.description && <span className="classic-desc">{item.description}</span>}
          {(details.length > 0 || explainer) && (
            <span className="classic-details">
              {details.length > 0 && <span>{details.join(" · ")}</span>}
              {explainer && (
                <span className="classic-whats">
                  <Info aria-hidden />
                  {t("menu_whats_this")}
                </span>
              )}
            </span>
          )}
        </button>
      </li>
    );
  }

  const hasFilters = dietOptions.length > 0 || allergens.length > 0;
  const activeFilters = diets.length + excluded.length;
  const dietLabel = (diet: string) =>
    FOOD_FILTERS.includes(diet) ? (
      <>
        <VegMark type={diet as NonNullable<MenuItem["foodType"]>} label="" />
        {diet === "egg" ? t("menu_egg") : t(FOOD_TYPE_KEYS[diet as NonNullable<MenuItem["foodType"]>])}
      </>
    ) : (
      t(DIETS[diet].key)
    );
  const shownCount = visibleSections.reduce((n, section) => n + section.items.length, 0);

  const sectionNav =
    visibleSections.length > 1 || hasFilters ? (
      <nav className="menu-jump menu-cats" aria-label={t("menu_sections")}>
        <button type="button" className="menu-browse" aria-label={t("menu_browse")} aria-haspopup="dialog" onClick={() => setBrowseOpen(true)}>
          <MenuLines aria-hidden />
          {activeFilters > 0 && <span className="menu-browse-count">{activeFilters}</span>}
        </button>
        {visibleSections.length > 1 && visibleSections.map((section) => (
          <button key={section.id} type="button" className="menu-cat" aria-current={section.id === current ? "true" : undefined} onClick={() => jumpTo(section.id)}>
            {section.name}
          </button>
        ))}
      </nav>
    ) : null;

  return (
    <div className="menu-page landing" data-style={style ?? undefined} data-layout={layout} data-header={branding.headerStyle ?? "cover"} data-shape={branding.buttonShape ?? "rounded"}>
      <main className="page-wrapper menu-body">
        {layout === "list" ? (
          <header className="menu-topbar">
            <a className="menu-back" href={backHref} aria-label={t("menu_back")}>
              <ChevronLeft aria-hidden />
            </a>
            <h1>{venueName}</h1>
          </header>
        ) : (
          <header className="classic-head">
            <a className="menu-back" href={backHref} aria-label={t("menu_back")}>
              <ChevronLeft aria-hidden />
            </a>
            <h1>{venueName}</h1>
            <p className="classic-kicker">
              <span>{menu && menus.length > 1 ? menu.name : t("menu_title")}</span>
            </p>
            {menu?.welcomeText?.trim() && <p className="classic-welcome">{menu.welcomeText.trim()}</p>}
          </header>
        )}

        {!menu ? (
          <div className="menu-empty">
            <h2>{t("menu_title")}</h2>
            <p>{t("menu_empty")}</p>
          </div>
        ) : (
          <>
            {layout === "list" && menu.welcomeText?.trim() && (
              <div className="menu-head">
                <p className="menu-welcome">{menu.welcomeText.trim()}</p>
              </div>
            )}

            {menus.length > 1 && (
              <div className="menu-chip-row menu-tabs" role="tablist">
                {menus.map((m, i) => (
                  <button key={m.id} type="button" role="tab" aria-selected={i === shownIndex} className="menu-chip" onClick={() => setMenuIndex(i)}>
                    {m.name}
                  </button>
                ))}
              </div>
            )}

            {sectionNav}

            <label className="menu-search">
              <Search aria-hidden />
              <input type="search" enterKeyHint="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("menu_search")} aria-label={t("menu_search")} />
            </label>

            {activeFilters > 0 && (
              <div className="menu-filters">
                {diets.map((diet) => (
                  <button key={diet} type="button" className="menu-pill on" aria-label={tf("menu_filter_off", { filter: FOOD_FILTERS.includes(diet) ? t(FOOD_TYPE_KEYS[diet as NonNullable<MenuItem["foodType"]>]) : t(DIETS[diet].key) })} onClick={() => toggleDiet(diet)}>
                    {dietLabel(diet)}
                    <X aria-hidden />
                  </button>
                ))}
                {excluded.map((allergen) => (
                  <button key={allergen} type="button" className="menu-pill on" aria-label={tf("menu_filter_remove", { allergen: titleCase(allergen) })} onClick={() => toggleAllergen(allergen)}>
                    {tf("menu_no_allergen", { allergen })}
                    <X aria-hidden />
                  </button>
                ))}
              </div>
            )}

            {layout === "list" && highlights.items.length > 0 && !needle && (
              <section className="menu-specials" aria-label={highlights.title}>
                <h2>
                  {highlights.title}
                  {highlights.title === t("menu_specials") && <span className="menu-specials-sub">{t("menu_specials_sub")}</span>}
                </h2>
                <div className="menu-specials-row">
                  {highlights.items.map((item) => {
                    const image = safeImageUrl(item.imageUrl);
                    return (
                      <button key={item.id} type="button" className="menu-special" onClick={() => showDish(item, "highlights")}>
                        <span className={`menu-special-photo${image ? "" : " placeholder"}`} aria-hidden>
                          {/* eslint-disable-next-line @next/next/no-img-element -- merchant image on any host */}
                          {image ? <img src={image} alt="" loading="lazy" /> : item.name.trim().charAt(0)}
                        </span>
                        <span className="menu-special-text">
                          <span className="menu-special-name">{item.name}</span>
                          <span className="menu-special-price">{formatPrice(item.priceInPence)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {hiddenByFilter > 0 && <p className="menu-note">{tf("menu_hidden_count", { count: hiddenByFilter })}</p>}

            {visibleSections.length === 0 ? (
              <p className="menu-note">{t("menu_no_results")}</p>
            ) : (
              visibleSections.map((section) => (
                <section key={section.id} id={`section-${section.id}`} className="menu-section">
                  <div className="menu-section-head">
                    <h2>{section.name}</h2>
                    <span>{section.items.length === 1 ? t("menu_items_one") : tf("menu_items", { count: section.items.length })}</span>
                  </div>
                  {section.description?.trim() && <p className="menu-section-desc">{section.description.trim()}</p>}
                  <ul className={layout === "list" ? "dish-list" : "classic-list"}>{section.items.map(layout === "list" ? dishRow : classicItem)}</ul>
                </section>
              ))
            )}

            <p className="menu-note small">{t(indian ? "menu_allergy_ask" : "menu_allergen_note")}</p>
            <p className="menu-note small menu-copyright">
              © {new Date().getFullYear()} {venueName}
            </p>
          </>
        )}
      </main>

      <MenuBrowseSheet
        open={browseOpen}
        groups={[
          ...(dietOptions.length > 0
            ? [{ title: t(indian ? "menu_food_type" : "menu_diet"), options: dietOptions.map((diet) => ({ key: diet, label: dietLabel(diet), on: diets.includes(diet), toggle: () => toggleDiet(diet) })) }]
            : []),
          ...(allergens.length > 0
            ? [{ title: t("menu_filter_title"), options: allergens.map((allergen) => ({ key: allergen, label: titleCase(allergen), on: excluded.includes(allergen), toggle: () => toggleAllergen(allergen) })) }]
            : []),
        ]}
        sections={visibleSections.map((section) => ({ id: section.id, name: section.name, count: section.items.length }))}
        current={current}
        labels={{ title: t("menu_browse"), categories: t("menu_categories"), clear: t("menu_filter_clear"), show: shownCount === 1 ? t("menu_show_one") : tf("menu_show_count", { count: shownCount }), close: t("close") }}
        onJump={(sectionId) => {
          setBrowseOpen(false);
          // After the sheet lets go of the page's scroll lock.
          requestAnimationFrame(() => jumpTo(sectionId));
        }}
        onClear={
          activeFilters > 0
            ? () => {
                setDiets([]);
                setExcluded([]);
              }
            : null
        }
        onClose={closeBrowse}
      />

      <DishSheet
        item={openDish}
        price={openDish ? formatPrice(openDish.priceInPence) : ""}
        tags={openDish ? tagList(openDish) : null}
        details={openDish ? (indian ? (openDish.foodType ? [t(FOOD_TYPE_KEYS[openDish.foodType])] : []) : allergenLines(openDish)) : []}
        labels={{ close: t("close"), whatsThis: t("menu_whats_this"), explainerNote: t("menu_explainer_allergens"), soldOut: t("menu_unavailable") }}
        onClose={closeDish}
      />
    </div>
  );
}
