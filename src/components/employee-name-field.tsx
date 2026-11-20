"use client";

import { useEffect, useRef, useState } from "react";
import { fieldClass } from "@/components/ui";

type Suggestion = { id: string; name: string; position: string; storeId: string; storeNumber: string };

export function EmployeeNameField({
  storeField,
  positionField,
  defaultValue = "",
  label = "Name",
}: {
  storeField?: string;
  positionField?: string;
  defaultValue?: string;
  label?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handle = window.setTimeout(async () => {
      const form = inputRef.current?.form ?? undefined;
      const storeId = storeField && form ? String(new FormData(form).get(storeField) || "") : "";
      if (value.trim().length < 1) {
        setItems([]);
        return;
      }
      const params = new URLSearchParams({ q: value });
      if (storeId) params.set("storeId", storeId);
      const response = await fetch(`/api/employees/suggest?${params.toString()}`);
      if (!response.ok) return;
      const body = (await response.json()) as { people?: Suggestion[] };
      setItems(body.people ?? []);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [value, storeField]);

  function choose(person: Suggestion, input: HTMLInputElement) {
    setValue(person.name);
    setOpen(false);
    const form = input.form;
    if (!form) return;
    if (storeField) {
      const store = form.elements.namedItem(storeField);
      if (store instanceof HTMLSelectElement && !store.value) store.value = person.storeId;
    }
    if (positionField) {
      const position = form.elements.namedItem(positionField);
      if (position instanceof HTMLSelectElement && !position.value && [...position.options].some((option) => option.value === person.position)) {
        position.value = person.position;
      }
      if (position instanceof HTMLInputElement && !position.value) position.value = person.position;
    }
  }

  return (
    <label className="relative text-sm font-semibold">
      {label}
      <input
        ref={inputRef}
        className={`${fieldClass} mt-1`}
        name="name"
        value={value}
        required
        autoComplete="off"
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && items.length > 0 ? (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-line bg-card text-sm shadow">
          {items.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-sun/40"
                onClick={() => {
                  if (inputRef.current) choose(person, inputRef.current);
                }}
              >
                {person.name}
                <span className="block text-xs font-normal text-ink/55">
                  {person.storeNumber}
                  {person.position ? ` · ${person.position}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}
