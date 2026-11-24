"use client";

import { useState, type ReactNode } from "react";
import { ghostButton } from "@/components/ui";

export function CollapsibleSections({
  sections,
  startOpen = [],
}: {
  sections: { id: string; title: string; count: string; body: ReactNode; emphasis?: boolean }[];
  startOpen?: string[];
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(startOpen.map((id) => [id, true])),
  );

  return (
    <div>
      {sections.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          <button
            className={ghostButton}
            type="button"
            onClick={() => setOpen(Object.fromEntries(sections.map((section) => [section.id, true])))}
          >
            Expand all
          </button>
          <button
            className={ghostButton}
            type="button"
            onClick={() => setOpen(Object.fromEntries(sections.map((section) => [section.id, false])))}
          >
            Collapse all
          </button>
        </div>
      ) : null}
      <div className="space-y-4">
        {sections.map((section) => {
          const expanded = open[section.id] === true;
          return (
            <section
              key={section.id}
              className={`rounded-3xl border bg-card print:break-inside-avoid ${section.emphasis ? "border-brick ring-2 ring-sun" : "border-line"}`}
            >
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left"
                aria-expanded={expanded}
                onClick={() => setOpen((current) => ({ ...current, [section.id]: !expanded }))}
              >
                <span className="font-display text-2xl">{section.title}</span>
                <span className="text-sm font-semibold">{section.count}</span>
              </button>
              <div className={expanded ? "px-4 pb-4" : "hidden px-4 pb-4 print:block"}>{section.body}</div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
