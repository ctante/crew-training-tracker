"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveModuleAction, moveModuleSectionAction, removeModuleAction, restoreModuleAction, retranslateModuleAction, saveModuleAction } from "@/app/actions";
import { LinkHint, ModuleLinks } from "@/components/module-links";
import { Flag, fieldClass, ghostButton, primaryButton } from "@/components/ui";
import { SECTIONS, type SectionId } from "@/lib/constants";
import { splitTitles } from "@/lib/format";
import { sectionTitle, type ModuleTemplate } from "@/lib/types";

export function ModuleEditor({ modules, language }: { modules: ModuleTemplate[]; language: "en" | "es" }) {
  const [query, setQuery] = useState("");
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({});
  const [cardsOpen, setCardsOpen] = useState<Record<string, boolean>>({});
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return modules;
    return modules.filter(
      (module) =>
        module.name.toLowerCase().includes(needle) ||
        module.sectionTitle.toLowerCase().includes(needle),
    );
  }, [modules, query]);
  const review = modules.filter((module) => module.needsReview && !module.archived).length;
  const active = shown.filter((module) => !module.archived);
  const archived = shown.filter((module) => module.archived);
  const searching = query.trim().length > 0;

  function sectionIsOpen(id: string, count: number) {
    if (searching) return count > 0;
    return sectionsOpen[id] === true;
  }

  function setEvery(open: boolean) {
    const sections: Record<string, boolean> = { archived: open };
    for (const section of SECTIONS) sections[section] = open;
    const cards: Record<string, boolean> = {};
    if (open) {
      for (const item of modules) cards[item.id] = true;
    }
    setSectionsOpen(sections);
    setCardsOpen(cards);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <label className="block min-w-64 flex-1 text-sm font-semibold">
          Find a module
          <input
            className={`${fieldClass} mt-1`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Fries, parrilla, verification"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button className={ghostButton} type="button" onClick={() => setEvery(true)}>
            Expand all
          </button>
          <button className={ghostButton} type="button" onClick={() => setEvery(false)}>
            Collapse all
          </button>
          <p className="text-sm text-ink/70">
            {review} link{review === 1 ? "" : "s"} in this language need review.
          </p>
        </div>
      </div>
      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const rows = active.filter((module) => module.section === section);
          const open = sectionIsOpen(section, rows.length);
          return (
            <section key={section} className="rounded-3xl border border-line bg-card/40">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                aria-expanded={open}
                onClick={() => setSectionsOpen((current) => ({ ...current, [section]: !sectionIsOpen(section, rows.length) }))}
              >
                <span className="font-display text-2xl">{sectionTitle(language, section)}</span>
                <span className="text-sm font-semibold text-ink/60">
                  {rows.length} {rows.length === 1 ? "module" : "modules"} · {open ? "Hide" : "Show"}
                </span>
              </button>
              {open ? (
                <div className="space-y-3 px-3 pb-3">
                  {rows.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-ink/60">No modules in this section.</p>
                  ) : (
                    rows.map((module, index) => (
                      <ModuleForm
                        key={module.id}
                        module={module}
                        canUp={index > 0}
                        canDown={index < rows.length - 1}
                        open={Boolean(cardsOpen[module.id])}
                        onToggle={() => setCardsOpen((current) => ({ ...current, [module.id]: !current[module.id] }))}
                      />
                    ))
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
      {archived.length > 0 ? (
        <section className="mt-8 rounded-3xl border border-line bg-card/40">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={sectionIsOpen("archived", archived.length)}
            onClick={() =>
              setSectionsOpen((current) => ({ ...current, archived: !sectionIsOpen("archived", archived.length) }))
            }
          >
            <span>
              <span className="font-display text-2xl">Archived</span>
              <span className="mt-1 block text-sm font-normal text-ink/60">Hidden from schedules. Progress already recorded stays in the database.</span>
            </span>
            <span className="text-sm font-semibold text-ink/60">{sectionIsOpen("archived", archived.length) ? "Hide" : "Show"}</span>
          </button>
          {sectionIsOpen("archived", archived.length) ? (
            <div className="space-y-3 px-3 pb-3">
              {archived.map((module) => (
                <ModuleForm
                  key={module.id}
                  module={module}
                  canUp={false}
                  canDown={false}
                  open={Boolean(cardsOpen[module.id])}
                  onToggle={() => setCardsOpen((current) => ({ ...current, [module.id]: !current[module.id] }))}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ModuleForm({
  module,
  canUp,
  canDown,
  open,
  onToggle,
}: {
  module: ModuleTemplate;
  canUp: boolean;
  canDown: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [section, setSection] = useState(module.section);
  const [name, setName] = useState(module.name);
  const [timeLabel, setTimeLabel] = useState(module.timeLabel);
  const [videoCount, setVideoCount] = useState(module.videoCount === null ? "" : String(module.videoCount));
  const [credit, setCredit] = useState(module.credit ?? "");
  const [link, setLink] = useState(module.link);
  const [videoTitles, setVideoTitles] = useState(module.videoTitles);
  const [esName, setEsName] = useState(module.spanish?.name ?? "");
  const [esTitles, setEsTitles] = useState(module.spanish?.videoTitles ?? "");
  const [esManual, setEsManual] = useState(module.spanish?.manualTranslation ?? false);
  const [esDirty, setEsDirty] = useState(false);
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const titles = splitTitles(videoTitles);
  const needsReview = /regId=/i.test(link);

  return (
    <form
      className="rounded-3xl border border-line bg-card p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        setStatus("Saving");
        startTransition(async () => {
          const result = await saveModuleAction({
            id: module.id,
            name,
            timeLabel,
            videoCount,
            credit,
            link,
            videoTitles,
            note: module.note,
            spanishManual: module.language === "en" && esDirty ? { name: esName, videoTitles: esTitles, note: module.spanish?.note ?? "" } : undefined,
          });
          if (!result.ok) {
            setStatus(result.error);
            return;
          }
          if (module.language === "es") setEsManual(true);
          if (result.spanish) {
            setEsName(result.spanish.name);
            setEsTitles(result.spanish.videoTitles);
            setEsManual(result.spanish.manual);
            setEsDirty(false);
          }
          setStatus(result.warning || "Saved");
        });
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" aria-expanded={open} onClick={onToggle}>
          <span className="text-xs font-semibold text-ink/45">
            {String(module.sortOrder).padStart(2, "0")}
            {timeLabel ? ` · ${timeLabel}` : ""}
            {videoCount ? ` · ${videoCount} videos` : ""}
            {credit ? ` · ${credit}` : ""}
          </span>
          <span className="block text-lg font-semibold leading-snug">{name}</span>
          <span className="text-xs font-semibold text-campus">{open ? "Hide" : "Edit"}</span>
        </button>
        <Flag kind={module.kind === "campus" ? "campus" : module.kind === "app" ? "app" : "floor"}>
          {module.kind === "campus" ? "Campus" : module.kind === "app" ? "App check" : "On the floor"}
        </Flag>
        {needsReview ? <Flag kind="review">Needs review</Flag> : null}
        {module.language === "es" && (esManual || module.manualTranslation) ? <Flag kind="manual">Edited by hand</Flag> : null}
        {module.archived ? <Flag kind="paused">Archived</Flag> : null}
        {module.archived ? null : (
          <span className="ml-auto flex gap-2">
            <button
              className={ghostButton}
              type="button"
              disabled={!canUp || pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await moveModuleAction(module.id, "up");
                  setStatus(result.ok ? "Moved up" : result.error);
                })
              }
            >
              Up
            </button>
            <button
              className={ghostButton}
              type="button"
              disabled={!canDown || pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await moveModuleAction(module.id, "down");
                  setStatus(result.ok ? "Moved down" : result.error);
                })
              }
            >
              Down
            </button>
          </span>
        )}
      </div>
      {open ? (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">
          Section
          <select
            className={`${fieldClass} mt-1`}
            value={section}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.value as SectionId;
              if (next === section) return;
              const previous = section;
              setSection(next);
              startTransition(async () => {
                const result = await moveModuleSectionAction(module.id, next);
                if (!result.ok) {
                  setSection(previous);
                  setStatus(result.error);
                  return;
                }
                setStatus("Moved to the end of that section.");
                router.refresh();
              });
            }}
          >
            {SECTIONS.map((item) => (
              <option key={item} value={item}>
                {sectionTitle(module.language, item)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs font-normal text-ink/60">
            Moving puts this module at the end of that section. The Spanish module moves with it, and saved progress stays.
          </p>
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Module
          <input className={`${fieldClass} mt-1`} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="text-sm font-semibold">
          Time
          <input className={`${fieldClass} mt-1`} value={timeLabel} onChange={(event) => setTimeLabel(event.target.value)} />
        </label>
        <label className="text-sm font-semibold">
          Videos
          <input
            className={`${fieldClass} mt-1`}
            inputMode="numeric"
            value={videoCount}
            onChange={(event) => setVideoCount(event.target.value)}
          />
        </label>
        <label className="text-sm font-semibold">
          Credit
          <select className={`${fieldClass} mt-1`} value={credit} onChange={(event) => setCredit(event.target.value)}>
            <option value="">Blank (on the floor)</option>
            <option value="Auto">Auto</option>
            <option value="Manual">Manual</option>
          </select>
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Link
          <textarea className={`${fieldClass} mt-1 min-h-20`} value={link} onChange={(event) => setLink(event.target.value)} placeholder="One link per line" />
          <LinkHint />
          {link.trim() ? (
            <div className="mt-3">
              <ModuleLinks link={link} preview />
            </div>
          ) : null}
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Video titles
          <textarea
            className={`${fieldClass} mt-1 min-h-20`}
            value={videoTitles}
            onChange={(event) => setVideoTitles(event.target.value)}
          />
        </label>
      </div>
      ) : null}
      {open && titles.length > 0 ? (
        <p className="mt-2 text-xs text-ink/55">{titles.length} titles parsed from the list.</p>
      ) : null}
      {open && module.language === "en" && module.spanish ? (
        <div className="mt-3 rounded-2xl border border-line bg-paper p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">Spanish text</h3>
            {esManual ? <Flag kind="manual">Edited by hand</Flag> : <Flag kind="auto">Auto</Flag>}
          </div>
          <p className="mb-3 text-xs text-ink/60">
            {esManual
              ? "Edited by hand. Saving English will not replace this wording until you click Re-translate."
              : "Filled from English. Edit it here if you want different wording."}
          </p>
          <div className="grid gap-3">
            <label className="text-sm font-semibold">
              Spanish name
              <input
                className={`${fieldClass} mt-1`}
                value={esName}
                onChange={(event) => {
                  setEsName(event.target.value);
                  setEsDirty(true);
                }}
              />
            </label>
            <label className="text-sm font-semibold">
              Spanish video titles
              <textarea
                className={`${fieldClass} mt-1 min-h-16`}
                value={esTitles}
                onChange={(event) => {
                  setEsTitles(event.target.value);
                  setEsDirty(true);
                }}
              />
            </label>
          </div>
        </div>
      ) : null}
      {open ? (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className={primaryButton} disabled={pending} type="submit">
          Save module
        </button>
        <button
          className={ghostButton}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await retranslateModuleAction(module.id);
              if (!result.ok) {
                setStatus(result.error);
                return;
              }
              if (module.language === "es") {
                setName(result.spanish.name);
                setVideoTitles(result.spanish.videoTitles);
              }
              setEsName(result.spanish.name);
              setEsTitles(result.spanish.videoTitles);
              setEsManual(result.spanish.manual);
              setEsDirty(false);
              setStatus(result.warning || "Spanish updated from English.");
            })
          }
        >
          Re-translate
        </button>
        {module.archived ? (
          <button
            className={ghostButton}
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await restoreModuleAction(module.id);
                setStatus(result.ok ? "Restored" : result.error);
              })
            }
          >
            Restore
          </button>
        ) : (
          <button
            className={ghostButton}
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await removeModuleAction(module.id);
                if (!result.ok) setStatus(result.error);
                else setStatus(result.outcome === "archived" ? "Archived. History kept." : "Removed.");
              })
            }
          >
            Remove
          </button>
        )}
        <p className="text-sm text-ink/60" aria-live="polite">
          {status}
        </p>
      </div>
      ) : status ? (
        <p className="mt-2 text-sm text-ink/60" aria-live="polite">
          {status}
        </p>
      ) : null}
    </form>
  );
}
