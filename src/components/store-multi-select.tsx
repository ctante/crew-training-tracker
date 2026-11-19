"use client";

import { useState } from "react";

export function StoreMultiSelect({
  stores,
  selected,
  entireOrg,
  hidden,
}: {
  stores: string[];
  selected: string[];
  entireOrg: boolean;
  hidden: Record<string, string>;
}) {
  const [org, setOrg] = useState(entireOrg);
  const [picked, setPicked] = useState<string[]>(entireOrg ? stores : selected);

  return (
    <form action="/reports" className="rounded-3xl border border-line bg-card p-4">
      {Object.entries(hidden)
        .filter(([, value]) => value)
        .map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
      <p className="text-sm font-semibold">Restaurants</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-paper px-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="org"
            value="1"
            className="h-5 w-5 accent-brick"
            checked={org}
            onChange={(event) => {
              const next = event.target.checked;
              setOrg(next);
              if (next) setPicked(stores);
            }}
          />
          Entire org
        </label>
        {stores.map((number) => {
          const checked = org || picked.includes(number);
          return (
            <label
              key={number}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-paper px-3 text-sm font-semibold"
            >
              <input
                type="checkbox"
                name="store"
                value={number}
                className="h-5 w-5 accent-brick"
                checked={checked}
                disabled={org}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...picked, number]
                    : picked.filter((item) => item !== number);
                  setPicked(next);
                  setOrg(next.length === stores.length);
                }}
              />
              {number}
            </label>
          );
        })}
      </div>
      <button className="mt-3 min-h-11 rounded-full bg-bark px-4 text-sm font-semibold text-white" type="submit">
        Apply stores
      </button>
    </form>
  );
}
