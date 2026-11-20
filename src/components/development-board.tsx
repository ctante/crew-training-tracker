"use client";

import { useState } from "react";
import { saveDevelopmentAction } from "@/app/actions";
import { fieldClass, ghostButton, primaryButton } from "@/components/ui";
import { HOUR_CHOICES, formatHourTotal, type DevelopmentStoreWeek } from "@/lib/development-hours";

export function DevelopmentBoard({
  sections,
  canEdit,
  tasks,
  week,
  store,
  position,
}: {
  sections: DevelopmentStoreWeek[];
  canEdit: boolean;
  tasks: string[];
  week: string;
  store: string;
  position: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(sections.map((item) => [item.id, true])));
  const [editing, setEditing] = useState(false);
  const showAll = canEdit && editing;

  function hasWork(person: DevelopmentStoreWeek["people"][number]) {
    return Boolean(person.hours.trim() || person.trainingNeeded.trim() || person.comments.trim());
  }

  const visible = sections
    .map((item) => ({ ...item, people: showAll ? item.people : item.people.filter(hasWork) }))
    .filter((item) => showAll || item.people.length > 0 || item.notes.trim());

  return (
    <form action={saveDevelopmentAction}>
      <input type="hidden" name="week" value={week} />
      <input type="hidden" name="store" value={store} />
      <input type="hidden" name="position" value={position} />
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <button className={ghostButton} type="button" onClick={() => setOpen(Object.fromEntries(sections.map((item) => [item.id, true])))}>
          Expand all
        </button>
        <button className={ghostButton} type="button" onClick={() => setOpen(Object.fromEntries(sections.map((item) => [item.id, false])))}>
          Collapse all
        </button>
        {canEdit ? (
          <button className={editing ? primaryButton : ghostButton} type="button" onClick={() => setEditing((value) => !value)}>
            {editing ? "Done editing" : "Edit"}
          </button>
        ) : null}
      </div>
      {visible.length === 0 ? <p className="text-sm text-ink/70">No work is assigned this week.</p> : null}
      <div className="space-y-4">
        {visible.map((item) => {
          const expanded = open[item.id] !== false;
          return (
            <section key={item.id} className="rounded-3xl border border-line bg-card print:break-inside-avoid print:border-0">
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left"
                aria-expanded={expanded}
                onClick={() => setOpen((current) => ({ ...current, [item.id]: !expanded }))}
              >
                <span className="font-display text-3xl">{item.number}</span>
                <span className="text-sm font-semibold">
                  {item.people.length} {item.people.length === 1 ? "person" : "people"} · {formatHourTotal(item.hoursTotal)} hours
                </span>
              </button>
              <div className={expanded ? "px-4 pb-4" : "hidden px-4 pb-4 print:block"}>
                  <div className="text-sm">
                    <p className="font-semibold">Store notes</p>
                    {showAll ? (
                      <textarea className={`${fieldClass} mt-1 min-h-20`} name={`notes:${item.id}`} defaultValue={item.notes} />
                    ) : (
                      <p className="mt-1 whitespace-pre-wrap text-ink/80">{item.notes || "None"}</p>
                    )}
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[48rem] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-line text-left">
                          <th className="py-2 pr-3 font-semibold">Employee</th>
                          <th className="py-2 pr-3 font-semibold">Position</th>
                          <th className="py-2 pr-3 font-semibold">Training Hours Needed</th>
                          <th className="py-2 pr-3 font-semibold">Training Needed</th>
                          <th className="py-2 font-semibold">Comments</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.people.map((person) => {
                          const working = hasWork(person);
                          return (
                            <tr key={person.id} className={working ? "bg-sun/50" : undefined}>
                              <td className="py-2 pr-3 align-top font-semibold">{person.name}</td>
                              <td className="py-2 pr-3 align-top">{person.position}</td>
                              <td className="py-2 pr-3 align-top">
                                {showAll ? (
                                  <select
                                    className={`${fieldClass} w-28`}
                                    name={`hours:${person.id}`}
                                    defaultValue={person.hours}
                                    aria-label={`Hours for ${person.name}`}
                                  >
                                    <option value=""> </option>
                                    {HOUR_CHOICES.map((choice) => (
                                      <option key={choice} value={choice}>
                                        {choice}
                                      </option>
                                    ))}
                                    {person.hours && !HOUR_CHOICES.includes(person.hours) ? (
                                      <option value={person.hours}>{person.hours}</option>
                                    ) : null}
                                  </select>
                                ) : (
                                  person.hours
                                )}
                              </td>
                              <td className="py-2 pr-3 align-top">
                                {showAll ? (
                                  <select
                                    className={fieldClass}
                                    name={`training:${person.id}`}
                                    defaultValue={tasks.includes(person.trainingNeeded) ? person.trainingNeeded : ""}
                                    aria-label={`Training needed for ${person.name}`}
                                  >
                                    <option value=""> </option>
                                    {tasks.map((task) => (
                                      <option key={task} value={task}>
                                        {task}
                                      </option>
                                    ))}
                                    {person.trainingNeeded && !tasks.includes(person.trainingNeeded) ? (
                                      <option value={person.trainingNeeded}>{person.trainingNeeded}</option>
                                    ) : null}
                                  </select>
                                ) : (
                                  person.trainingNeeded
                                )}
                              </td>
                              <td className="py-2 align-top">
                                {showAll ? (
                                  <textarea
                                    className={`${fieldClass} min-h-16`}
                                    name={`comments:${person.id}`}
                                    defaultValue={person.comments}
                                    aria-label={`Comments for ${person.name}`}
                                  />
                                ) : (
                                  <span className="whitespace-pre-wrap">{person.comments}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {item.people.length === 0 ? <p className="mt-3 text-sm text-ink/60">No one to show.</p> : null}
                  </div>
                </div>
            </section>
          );
        })}
      </div>
      {showAll ? (
        <button className={`${primaryButton} mt-4 print:hidden`} type="submit">
          Save week
        </button>
      ) : null}
    </form>
  );
}
