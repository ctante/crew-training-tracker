"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTraineeAction } from "@/app/actions";
import { fieldClass, primaryButton } from "@/components/ui";

export function NewTraineeForm({
  stores,
  today,
}: {
  stores: { id: string; number: string; name: string }[];
  today: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid max-w-xl gap-4 rounded-3xl border border-line bg-card p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError("");
        startTransition(async () => {
          const result = await createTraineeAction({
            name: String(form.get("name") || ""),
            storeId: String(form.get("storeId") || ""),
            startDate: String(form.get("startDate") || ""),
            language: String(form.get("language") || ""),
            position: String(form.get("position") || ""),
          });
          if ("error" in result && result.error) {
            setError(result.error);
            return;
          }
          if ("id" in result && result.id) router.push(`/trainees/${result.id}`);
        });
      }}
    >
      <label className="text-sm font-semibold">
        Name
        <input className={`${fieldClass} mt-1`} name="name" required minLength={2} placeholder="First and last name" />
      </label>
      <label className="text-sm font-semibold">
        Restaurant
        <select className={`${fieldClass} mt-1`} name="storeId" required defaultValue={stores[0]?.id}>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.number} {store.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold">
        Start date
        <input className={`${fieldClass} mt-1`} type="date" name="startDate" required defaultValue={today} />
      </label>
      <label className="text-sm font-semibold">
        Language
        <select className={`${fieldClass} mt-1`} name="language" defaultValue="en">
          <option value="en">English</option>
          <option value="es">Spanish</option>
        </select>
      </label>
      <label className="text-sm font-semibold">
        Position
        <input className={`${fieldClass} mt-1`} name="position" list="positions" placeholder="Optional" />
        <datalist id="positions">
          <option value="Crew" />
          <option value="Crew Trainer" />
          <option value="Shift Manager" />
          <option value="Assistant Manager" />
        </datalist>
      </label>
      {error ? <p className="text-sm text-brick-dark">{error}</p> : null}
      <button className={primaryButton} disabled={pending} type="submit">
        {pending ? "Adding" : "Create path"}
      </button>
      <p className="text-sm text-ink/60">
        The 36 modules for the chosen language are attached in sheet order. Schedule each one from the trainee page.
      </p>
    </form>
  );
}
