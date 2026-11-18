"use client";

import { useMemo, useState, useTransition } from "react";
import { saveModuleAction } from "@/app/actions";
import { Flag, fieldClass, primaryButton } from "@/components/ui";
import { splitTitles } from "@/lib/format";
import type { ModuleTemplate } from "@/lib/types";

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
  const review = modules.filter((module) => module.needsReview).length;

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
        {shown.map((module) => (
          <ModuleForm key={module.id} module={module} />
        ))}
      </div>
    </div>
  );
}

function ModuleForm({ module }: { module: ModuleTemplate }) {
  const [name, setName] = useState(module.name);
  const [timeLabel, setTimeLabel] = useState(module.timeLabel);
  const [videoCount, setVideoCount] = useState(module.videoCount === null ? "" : String(module.videoCount));
  const [credit, setCredit] = useState(module.credit ?? "");
  const [link, setLink] = useState(module.link);
  const [videoTitles, setVideoTitles] = useState(module.videoTitles);
  const [note, setNote] = useState(module.note);
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
          });
          setStatus(result.ok ? "Saved" : result.error);
        });
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink/45">{String(module.sortOrder).padStart(2, "0")}</span>
        <Flag kind={module.kind === "campus" ? "campus" : module.kind === "app" ? "app" : "floor"}>
          {module.sectionTitle}
        </Flag>
        {needsReview ? <Flag kind="review">Needs review</Flag> : null}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
          Campus link
          <input className={`${fieldClass} mt-1`} value={link} onChange={(event) => setLink(event.target.value)} />
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
      <div className="mt-3 flex items-center gap-3">
        <button className={primaryButton} disabled={pending} type="submit">
          Save module
        </button>
        <p className="text-sm text-ink/60" aria-live="polite">
          {status}
        </p>
      </div>
    </form>
  );
}
