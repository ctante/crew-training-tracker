"use client";

import { useState, useTransition } from "react";
import { saveProgressAction } from "@/app/actions";
import { Flag, fieldClass } from "@/components/ui";
import { groupByTrainerPosition } from "@/lib/constants";
import { formatShortDate } from "@/lib/format";
import type { EditorModule, TrainerOption } from "@/lib/types";

type CardState = {
  scheduledDate: string;
  trainerValue: string;
  completed: boolean;
  completedDate: string;
  notes: string;
};

export function TraineeEditor({
  modules,
  trainers,
  today,
}: {
  modules: EditorModule[];
  trainers: TrainerOption[];
  today: string;
}) {
  return (
    <div className="space-y-3">
      {modules.map((module, index) => {
        const previous = modules[index - 1];
        const showSection = !previous || previous.section !== module.section;
        return (
          <div key={module.id}>
            {showSection ? (
              <h2 className="mb-2 mt-6 font-display text-2xl text-ink first:mt-0" id={module.section.toLowerCase()}>
                {module.sectionTitle}
              </h2>
            ) : null}
            {module.blockName ? (
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink/50">
                Sheet block · {module.blockName} · {module.blockHours}
              </p>
            ) : null}
            <ModuleCard module={module} trainers={trainers} today={today} />
          </div>
        );
      })}
    </div>
  );
}

function ModuleCard({
  module,
  trainers,
  today,
}: {
  module: EditorModule;
  trainers: TrainerOption[];
  today: string;
}) {
  const [state, setState] = useState<CardState>({
    scheduledDate: module.scheduledDate,
    trainerValue: module.trainerValue,
    completed: module.completed,
    completedDate: module.completedDate,
    notes: module.notes,
  });
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  function persist(next: CardState) {
    setState(next);
    setStatus("Saving");
    startTransition(async () => {
      const result = await saveProgressAction({
        traineeModuleId: module.id,
        scheduledDate: next.scheduledDate,
        trainerValue: next.trainerValue,
        completed: next.completed,
        completedDate: next.completedDate,
        notes: next.notes,
      });
      setStatus(result.ok ? "Saved" : result.error);
    });
  }

  const overdue = !state.completed && state.scheduledDate && state.scheduledDate < today;
  const dueToday = !state.completed && state.scheduledDate === today;
  const groups = groupByTrainerPosition(trainers);
  const known = trainers.some((trainer) => `staff:${trainer.id}` === state.trainerValue);
  const customLabel = state.trainerValue.startsWith("label:")
    ? state.trainerValue.slice("label:".length)
    : "";

  return (
    <article
      id={`module-${module.sortOrder}`}
      className={`scroll-mt-24 rounded-3xl border bg-card p-4 shadow-sm ${
        overdue ? "border-brick/50" : dueToday ? "border-sun" : "border-line"
      } ${state.completed ? "opacity-80" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-ink/45">
            {String(module.sortOrder).padStart(2, "0")}
            {module.timeLabel ? ` · ${module.timeLabel}` : ""}
            {module.videoCount ? ` · ${module.videoCount} videos` : ""}
          </p>
          <h3 className="text-lg font-semibold leading-snug">{module.name}</h3>
        </div>
        <div className="flex flex-wrap gap-1">
          <Flag kind={module.kind === "campus" ? "campus" : module.kind === "app" ? "app" : "floor"}>
            {module.kind === "campus" ? "Campus" : module.kind === "app" ? "App check" : "On the floor"}
          </Flag>
          {module.credit ? <Flag kind={module.credit === "Auto" ? "auto" : "manual"}>{module.credit}</Flag> : null}
          {module.needsReview ? <Flag kind="review">Needs review</Flag> : null}
          {overdue ? <Flag kind="overdue">Overdue</Flag> : null}
          {dueToday ? <Flag kind="today">Due today</Flag> : null}
        </div>
      </div>

      {module.note ? <p className="mt-2 text-sm text-sun-deep">{module.note}</p> : null}
      {module.needsReview ? (
        <p className="mt-2 text-sm text-sun-deep">
          This Campus link includes a personal regId, so it may only open for the person who was enrolled.
          Replace it in Admin when a shared link is available.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {module.link ? (
          <a
            href={module.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-full bg-campus px-4 text-sm font-semibold text-white"
          >
            Open module
          </a>
        ) : (
          <span className="text-sm text-ink/55">Hands-on session. Schedule a trainer and a date.</span>
        )}
        {module.videoTitles.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-campus">Video titles</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink/80">
              {module.videoTitles.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Training date
          <input
            type="date"
            className={`${fieldClass} mt-1`}
            value={state.scheduledDate}
            onChange={(event) => persist({ ...state, scheduledDate: event.target.value })}
          />
          {state.scheduledDate ? (
            <span className="mt-1 block font-normal text-ink/55">{formatShortDate(state.scheduledDate)}</span>
          ) : null}
        </label>
        <label className="block text-sm font-semibold">
          Qualified trainer
          <select
            className={`${fieldClass} mt-1`}
            value={state.trainerValue}
            onChange={(event) => persist({ ...state, trainerValue: event.target.value })}
          >
            <option value="">Unassigned</option>
            <option value="orientation">Orientation</option>
            {groups.map((group) => (
              <optgroup key={group.position} label={group.position}>
                {group.people.map((trainer) => (
                  <option key={trainer.id} value={`staff:${trainer.id}`}>
                    {trainer.name}
                    {trainer.isGm ? " · GM" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
            {customLabel ? <option value={state.trainerValue}>{customLabel} (imported name)</option> : null}
            {!known && state.trainerValue.startsWith("staff:") ? (
              <option value={state.trainerValue}>
                {module.trainerLabel || "Assigned trainer"} (not qualified)
              </option>
            ) : null}
          </select>
          {trainers.length === 0 ? (
            <span className="mt-1 block font-normal text-ink/55">
              No qualified trainers at this restaurant. Import the Development Report.
            </span>
          ) : (
            <span className="mt-1 block font-normal text-ink/55">From this restaurant&apos;s qualified roster.</span>
          )}
        </label>
      </div>

      <label className="mt-3 block text-sm font-semibold">
        Notes
        <textarea
          className={`${fieldClass} mt-1 min-h-16`}
          value={state.notes}
          onChange={(event) => setState({ ...state, notes: event.target.value })}
          onBlur={(event) => persist({ ...state, notes: event.target.value })}
          placeholder="Optional note for the GM or trainer"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="h-5 w-5 accent-brick"
            checked={state.completed}
            onChange={(event) => {
              const completed = event.target.checked;
              const completedDate = completed
                ? state.completedDate ||
                  (state.scheduledDate && state.scheduledDate <= today ? state.scheduledDate : today)
                : "";
              persist({ ...state, completed, completedDate });
            }}
          />
          Completed
        </label>
        {state.completed ? (
          <label className="text-sm font-semibold">
            Completed date
            <input
              type="date"
              className={`${fieldClass} mt-1`}
              value={state.completedDate}
              onChange={(event) => persist({ ...state, completedDate: event.target.value })}
            />
          </label>
        ) : null}
        <p className="pb-2 text-xs text-ink/50" aria-live="polite">
          {pending ? "Saving" : status}
        </p>
      </div>
    </article>
  );
}
