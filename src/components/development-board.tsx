"use client";

import { useState } from "react";
import {
  addDevelopmentWorkAction,
  deactivateDevelopmentPersonAction,
  restoreDevelopmentPersonAction,
  saveDevelopmentAction,
  updateDevelopmentPersonAction,
} from "@/app/actions";
import { fieldClass, ghostButton, primaryButton } from "@/components/ui";
import { DEVELOPMENT_POSITIONS } from "@/lib/constants";
import { DEVELOPMENT_ACTIVITY, HOUR_CHOICES, developmentHours, formatHourTotal, type DevelopmentStoreWeek } from "@/lib/development-hours";

type StoreChoice = { id: string; number: string };

export function DevelopmentBoard({
  sections,
  canEdit,
  canManageRoster,
  tasks,
  week,
  store,
  position,
  storeChoices,
  showEveryone,
  everyoneHref,
  workHref,
}: {
  sections: DevelopmentStoreWeek[];
  canEdit: boolean;
  canManageRoster: boolean;
  tasks: string[];
  week: string;
  store: string;
  position: string;
  storeChoices: StoreChoice[];
  showEveryone: boolean;
  everyoneHref: string;
  workHref: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);
  const [addingWork, setAddingWork] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const showAll = canEdit && editing;
  const managePeople = showAll && canManageRoster;
  const rosterPeople = sections.flatMap((item) =>
    item.people.filter((person) => person.active).map((person) => ({ ...person, storeNumber: item.number })),
  );

  function hasWork(person: DevelopmentStoreWeek["people"][number]) {
    return Boolean(person.hours.trim() || person.trainingNeeded.trim() || person.comments.trim());
  }

  function includePerson(person: DevelopmentStoreWeek["people"][number]) {
    if (showAll || showEveryone) return person.active || showRemoved;
    return hasWork(person);
  }

  const visible = sections
    .map((item) => {
      const people = item.people.filter(includePerson);
      return {
        ...item,
        people,
        hoursTotal: people.reduce((sum, person) => sum + developmentHours(person.hours), 0),
      };
    })
    .filter((item) => showAll || showEveryone || item.people.length > 0 || item.notes.trim());
  const anyPeople = visible.some((item) => item.people.length > 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        {canEdit ? (
          <button className={ghostButton} type="button" onClick={() => setAddingWork((value) => !value)}>
            Add work
          </button>
        ) : null}
      </div>
      {addingWork && canEdit ? (
        <form action={addDevelopmentWorkAction} className="mb-4 rounded-3xl border border-line bg-card p-4 print:hidden">
          <h2 className="font-display text-2xl">Add Work</h2>
          <p className="mt-1 text-sm text-ink/70">Records hours, a development activity, or a comment for someone already on the roster.</p>
          <input type="hidden" name="week" value={week} />
          <input type="hidden" name="returnStore" value={store} />
          <input type="hidden" name="returnPosition" value={position} />
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm font-semibold">
              Person
              <select className={`${fieldClass} mt-1`} name="staffId" required defaultValue={rosterPeople[0]?.id ?? ""}>
                {rosterPeople.length === 0 ? <option value="">No one on the roster</option> : null}
                {rosterPeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.storeNumber} · {person.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Hours
              <select className={`${fieldClass} mt-1 w-28`} name="hours" defaultValue="">
                <option value=""> </option>
                {HOUR_CHOICES.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              {DEVELOPMENT_ACTIVITY.en}
              <span className="mt-0.5 block text-xs font-normal text-ink/50">{DEVELOPMENT_ACTIVITY.es}</span>
              <select className={`${fieldClass} mt-1`} name="trainingNeeded" defaultValue="">
                <option value=""> </option>
                {tasks.map((task) => (
                  <option key={task} value={task}>
                    {task}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-48 text-sm font-semibold">
              Comments
              <input className={`${fieldClass} mt-1`} name="comments" />
            </label>
            <button className={primaryButton} type="submit">
              Save work
            </button>
            <button className={ghostButton} type="button" onClick={() => setAddingWork(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
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
          {managePeople ? (
            <button className={showRemoved ? primaryButton : ghostButton} type="button" onClick={() => setShowRemoved((value) => !value)}>
              {showRemoved ? "Hide removed" : "Show removed"}
            </button>
          ) : null}
          {!showAll && !showEveryone ? (
            <a className={ghostButton} href={everyoneHref}>
              Show everyone
            </a>
          ) : null}
          {!showAll && showEveryone ? (
            <a className={ghostButton} href={workHref}>
              Show only people with work
            </a>
          ) : null}
        </div>
        {!anyPeople && !showAll && !showEveryone ? (
          <div className="mb-4 rounded-3xl border border-line bg-card p-4">
            <p className="text-sm text-ink/80">No work is assigned this week. The roster is still here.</p>
            <a className={`${primaryButton} mt-3`} href={everyoneHref}>
              Show everyone
            </a>
          </div>
        ) : null}
        {!anyPeople && (showAll || showEveryone) ? (
          <p className="mb-4 text-sm text-ink/70">No active people are on the roster for these restaurants.</p>
        ) : null}
        <div className="space-y-4">
          {visible.map((item) => {
            const expanded = open[item.id] === true;
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
                    <p className="font-semibold">Store Notes</p>
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
                          <th className="py-2 pr-3 font-semibold">
                            {DEVELOPMENT_ACTIVITY.en}
                            <span className="mt-0.5 block text-xs font-normal text-ink/50">{DEVELOPMENT_ACTIVITY.es}</span>
                          </th>
                          <th className="py-2 pr-3 font-semibold">Comments</th>
                          {managePeople ? <th className="py-2 font-semibold print:hidden">Roster</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {item.people.map((person) => {
                          const working = hasWork(person);
                          const editForm = `person-${person.id}`;
                          const removeForm = `remove-${person.id}`;
                          const restoreForm = `restore-${person.id}`;
                          return (
                            <tr key={person.id} className={working ? "bg-sun/50" : undefined}>
                              <td className="py-2 pr-3 align-top font-semibold">
                                <span className={managePeople ? "hidden print:inline" : undefined}>
                                  {person.name}
                                  {person.active ? "" : " · Removed"}
                                </span>
                                {managePeople ? (
                                  <div className="print:hidden">
                                    <input type="hidden" name="id" value={person.id} form={editForm} />
                                    <input type="hidden" name="week" value={week} form={editForm} />
                                    <input type="hidden" name="returnStore" value={store} form={editForm} />
                                    <input type="hidden" name="returnPosition" value={position} form={editForm} />
                                    <input
                                      className={fieldClass}
                                      name="name"
                                      form={editForm}
                                      defaultValue={person.name}
                                      aria-label={`Name for ${person.name}`}
                                      required
                                    />
                                    <label className="mt-2 block text-xs font-semibold">
                                      Store
                                      <select
                                        className={`${fieldClass} mt-1`}
                                        name="storeId"
                                        form={editForm}
                                        defaultValue={item.id}
                                        aria-label={`Store for ${person.name}`}
                                      >
                                        {storeChoices.map((choice) => (
                                          <option key={choice.id} value={choice.id}>
                                            {choice.number}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <div className="mt-2">
                                      <button className={ghostButton} type="submit" form={editForm}>
                                        Save person
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </td>
                              <td className="py-2 pr-3 align-top">
                                <span className={managePeople ? "hidden print:inline" : undefined}>{person.position}</span>
                                {managePeople ? (
                                  <select
                                    className={`${fieldClass} print:hidden`}
                                    name="position"
                                    form={editForm}
                                    defaultValue={DEVELOPMENT_POSITIONS.some((choice) => choice.value === person.position) ? person.position : "Crew Trainer"}
                                    aria-label={`Position for ${person.name}`}
                                    required
                                  >
                                    {DEVELOPMENT_POSITIONS.map((choice) => (
                                      <option key={choice.value} value={choice.value}>
                                        {choice.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : null}
                              </td>
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
                                    aria-label={`${DEVELOPMENT_ACTIVITY.en} for ${person.name}`}
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
                              {managePeople ? (
                                <td className="py-2 align-top print:hidden">
                                  {person.active ? (
                                    <button className={ghostButton} type="submit" form={removeForm}>
                                      Remove
                                    </button>
                                  ) : (
                                    <button className={ghostButton} type="submit" form={restoreForm}>
                                      Restore
                                    </button>
                                  )}
                                </td>
                              ) : null}
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
      {managePeople
        ? sections.flatMap((item) =>
            item.people.map((person) => (
              <div key={person.id}>
                <form id={`person-${person.id}`} action={updateDevelopmentPersonAction} />
                <form
                  id={`remove-${person.id}`}
                  action={deactivateDevelopmentPersonAction}
                  onSubmit={(event) => {
                    if (!window.confirm(`Remove ${person.name} from the roster? Past weeks and training history stay.`)) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="id" value={person.id} />
                  <input type="hidden" name="week" value={week} />
                  <input type="hidden" name="returnStore" value={store} />
                  <input type="hidden" name="returnPosition" value={position} />
                </form>
                <form id={`restore-${person.id}`} action={restoreDevelopmentPersonAction}>
                  <input type="hidden" name="id" value={person.id} />
                  <input type="hidden" name="week" value={week} />
                  <input type="hidden" name="returnStore" value={store} />
                  <input type="hidden" name="returnPosition" value={position} />
                </form>
              </div>
            )),
          )
        : null}
    </div>
  );
}
