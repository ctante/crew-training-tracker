"use client";

import { useState } from "react";
import { deactivateDevelopmentPersonAction, restoreDevelopmentPersonAction } from "@/app/actions";
import { CollapsibleSections } from "@/components/collapsible-sections";
import { ghostButton, primaryButton } from "@/components/ui";
import { groupByTrainerPosition } from "@/lib/constants";
import { storeLabel } from "@/lib/format";

type Person = {
  id: string;
  name: string;
  position: string;
  isGm: boolean;
  isSample: boolean;
  active: boolean;
};

export function RosterPeople({
  stores,
  canManage,
  filterStore = "",
  filterPosition = "",
}: {
  stores: { id: string; number: string; trainers: Person[]; removed: Person[] }[];
  canManage: boolean;
  filterStore?: string;
  filterPosition?: string;
}) {
  const [showRemoved, setShowRemoved] = useState(false);

  return (
    <div>
      <div className="mb-4">
        <button className={showRemoved ? primaryButton : ghostButton} type="button" onClick={() => setShowRemoved((value) => !value)}>
          {showRemoved ? "Hide removed" : "Show removed"}
        </button>
      </div>
      <CollapsibleSections
        sections={stores.map((store) => {
          const people = showRemoved ? [...store.trainers, ...store.removed] : store.trainers;
          const count = showRemoved
            ? `${store.trainers.length} qualified · ${store.removed.length} removed`
            : `${store.trainers.length} qualified`;
          return {
            id: store.id,
            title: storeLabel(store.number),
            count,
            body:
              people.length === 0 ? (
                <p className="text-sm text-ink/60">No qualified trainers yet.</p>
              ) : (
                groupByTrainerPosition(people).map((group) => (
                  <div key={group.position} className="mt-3">
                    <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">{group.position}</h3>
                    <ul className="mt-1 space-y-2 text-sm">
                      {group.people.map((person) => (
                        <li key={person.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {person.name}
                            {person.isGm ? " · GM" : ""}
                            {person.isSample ? " · Sample" : ""}
                            {person.active ? "" : " · Removed"}
                          </span>
                          {canManage && person.active ? (
                            <form
                              action={deactivateDevelopmentPersonAction}
                              onSubmit={(event) => {
                                if (!window.confirm(`Remove ${person.name} from the roster? They leave the trainer list. Past weeks stay.`)) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              <input type="hidden" name="id" value={person.id} />
                              <input type="hidden" name="returnTo" value="roster" />
                              <input type="hidden" name="filterStore" value={filterStore} />
                              <input type="hidden" name="filterPosition" value={filterPosition} />
                              <button className={ghostButton} type="submit">
                                Remove
                              </button>
                            </form>
                          ) : null}
                          {canManage && !person.active ? (
                            <form action={restoreDevelopmentPersonAction}>
                              <input type="hidden" name="id" value={person.id} />
                              <input type="hidden" name="returnTo" value="roster" />
                              <input type="hidden" name="filterStore" value={filterStore} />
                              <input type="hidden" name="filterPosition" value={filterPosition} />
                              <button className={ghostButton} type="submit">
                                Restore
                              </button>
                            </form>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ),
          };
        })}
      />
    </div>
  );
}
