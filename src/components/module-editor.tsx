"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveModuleAction, moveModuleSectionAction, removeModuleAction, restoreModuleAction, retranslateModuleAction, saveModuleAction } from "@/app/actions";
import { LinkHint, ModuleLinks } from "@/components/module-links";
import { Flag, fieldClass, ghostButton, primaryButton } from "@/components/ui";
import { SECTIONS, type SectionId } from "@/lib/constants";
import { splitTitles } from "@/lib/format";
import { sectionTitle, type ModuleTemplate } from "@/lib/types";

export function ModuleEditor({ modules }: { modules: ModuleTemplate[] }) {
  const [query, setQuery] = useState("");
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
        <p className="text-sm text-ink/70">
          {review} link{review === 1 ? "" : "s"} in this language need review.
        </p>
      </div>
      <div className="space-y-3">
        {active.map((module) => {
          const section = active.filter((item) => item.section === module.section);
          const index = section.findIndex((item) => item.id === module.id);
          return (
            <ModuleForm
              key={module.id}
              module={module}
              canUp={index > 0}
              canDown={index >= 0 && index < section.length - 1}
            />
          );
        })}
      </div>
      {archived.length > 0 ? (
        <div className="mt-8 space-y-3">
          <h2 className="font-display text-2xl">Archived</h2>
          <p className="text-sm text-ink/60">Hidden from schedules. Progress already recorded stays in the database.</p>
          {archived.map((module) => (
            <ModuleForm key={module.id} module={module} canUp={false} canDown={false} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ModuleForm({
  module,
  canUp,
  canDown,
}: {
  module: ModuleTemplate;
  canUp: boolean;
  canDown: boolean;
}) {
  const router = useRouter();
  const [section, setSection] = useState(module.section);
  const [name, setName] = useState(module.name);
  const [timeLabel, setTimeLabel] = useState(module.timeLabel);
  const [videoCount, setVideoCount] = useState(module.videoCount === null ? "" : String(module.videoCount));
  const [credit, setCredit] = useState(module.credit ?? "");
  const [link, setLink] = useState(module.link);
  const [videoTitles, setVideoTitles] = useState(module.videoTitles);
  const [note, setNote] = useState(module.note);
  const [esName, setEsName] = useState(module.spanish?.name ?? "");
  const [esTitles, setEsTitles] = useState(module.spanish?.videoTitles ?? "");
  const [esNote, setEsNote] = useState(module.spanish?.note ?? "");
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
            note,
            spanishManual: module.language === "en" && esDirty ? { name: esName, videoTitles: esTitles, note: esNote } : undefined,
          });
          if (!result.ok) {
            setStatus(result.error);
            return;
          }
          if (module.language === "es") setEsManual(true);
          if (result.spanish) {
            setEsName(result.spanish.name);
            setEsTitles(result.spanish.videoTitles);
            setEsNote(result.spanish.note);
            setEsManual(result.spanish.manual);
            setEsDirty(false);
          }
          setStatus(result.warning || "Saved");
        });
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink/45">{String(module.sortOrder).padStart(2, "0")}</span>
        <Flag kind={module.kind === "campus" ? "campus" : module.kind === "app" ? "app" : "floor"}>
          {module.sectionTitle}
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
        <label className="text-sm font-semibold sm:col-span-2">
          Note
          <textarea className={`${fieldClass} mt-1 min-h-16`} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      </div>
      {titles.length > 0 ? (
        <p className="mt-2 text-xs text-ink/55">{titles.length} titles parsed from the list.</p>
      ) : null}
      {module.language === "en" && module.spanish ? (
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
            <label className="text-sm font-semibold">
              Spanish note
              <textarea
                className={`${fieldClass} mt-1 min-h-16`}
                value={esNote}
                onChange={(event) => {
                  setEsNote(event.target.value);
                  setEsDirty(true);
                }}
              />
            </label>
          </div>
        </div>
      ) : null}
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
                setNote(result.spanish.note);
              }
              setEsName(result.spanish.name);
              setEsTitles(result.spanish.videoTitles);
              setEsNote(result.spanish.note);
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
    </form>
  );
}
