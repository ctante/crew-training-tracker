"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Flag } from "@/components/ui";
import { storeLabel } from "@/lib/format";
import { sessionSurface } from "@/lib/session-tone";
import type { ScheduleSession } from "@/lib/types";

export function ScheduleGroups({ sessions, empty }: { sessions: ScheduleSession[]; empty: string }) {
  const groups = useMemo(() => {
    const map = new Map<string, ScheduleSession[]>();
    for (const session of [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder)) {
      map.set(session.traineeId, [...(map.get(session.traineeId) ?? []), session]);
    }
    return [...map.entries()].sort(
      (a, b) => a[1][0].storeNumber.localeCompare(b[1][0].storeNumber) || a[1][0].traineeName.localeCompare(b[1][0].traineeName),
    );
  }, [sessions]);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (groups.length === 0) {
    return <p className="mt-2 rounded-3xl border border-dashed border-line bg-card px-4 py-8 text-center text-sm text-ink/70">{empty}</p>;
  }

  return (
    <div className="mt-3">
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-semibold"
          onClick={() => setOpen(Object.fromEntries(groups.map(([id]) => [id, true])))}
        >
          Expand all
        </button>
        <button
          type="button"
          className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-semibold"
          onClick={() => setOpen(Object.fromEntries(groups.map(([id]) => [id, false])))}
        >
          Collapse all
        </button>
      </div>
      <div className="space-y-3">
        {groups.map(([traineeId, rows]) => {
          const expanded = open[traineeId] === true;
          const overdueCount = rows.filter((session) => session.overdue).length;
          const todayCount = rows.filter((session) => session.dueToday).length;
          return (
            <section key={traineeId} className={`rounded-3xl border ${sessionSurface({ overdue: overdueCount > 0, dueToday: todayCount > 0 })}`}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                aria-expanded={expanded}
                onClick={() => setOpen((current) => ({ ...current, [traineeId]: !expanded }))}
              >
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-ink/55">{storeLabel(rows[0].storeNumber)}</span>
                  <span className="block text-lg font-semibold">{rows[0].traineeName}</span>
                  <span className="mt-1 block text-sm text-ink/70">
                    {rows.length} {rows.length === 1 ? "session" : "sessions"}
                    {todayCount > 0 ? ` · ${todayCount} today` : ""}
                    {overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}
                  </span>
                </span>
                <span className="text-sm font-semibold text-ink/60">{expanded ? "Hide" : "Show"}</span>
              </button>
              {expanded ? (
                <div className="space-y-2 px-4 pb-4">
                  {rows.map((session) => (
                    <SessionCard key={session.id} session={session} />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SessionCard({ session }: { session: ScheduleSession }) {
  return (
    <Link
      href={`/trainees/${session.traineeId}#module-${session.sortOrder}`}
      className={`block rounded-3xl border px-4 py-3 shadow-sm ${sessionSurface({ overdue: session.overdue, dueToday: session.dueToday })}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
            {formatDate(session.date)} · {session.sectionTitle}
            {session.timeLabel ? ` · ${session.timeLabel}` : ""}
          </p>
          <p className="font-semibold">{session.moduleName}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {session.overdue ? <Flag kind="overdue">Overdue</Flag> : null}
          {session.dueToday ? <Flag kind="today">Due today</Flag> : null}
          {session.traineeStatus === "PAUSED" ? <Flag kind="paused">Paused</Flag> : null}
          <Flag kind={session.kind === "campus" ? "campus" : session.kind === "app" ? "app" : "floor"}>
            {session.kind === "campus" ? "Campus" : session.kind === "app" ? "App" : "Floor"}
          </Flag>
        </div>
      </div>
      <p className="mt-1 text-sm text-ink/70">
        {session.trainerName ? session.trainerName : "Trainer not assigned"}
        {session.trainerIsGm ? " · GM" : ""}
      </p>
    </Link>
  );
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
