"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTraineeAction } from "@/app/actions";
import { EmployeeNameField } from "@/components/employee-name-field";
import { PositionSelect } from "@/components/position-select";
import { fieldClass, primaryButton } from "@/components/ui";

export function NewTraineeForm({
  stores,
  today,
  positions,
}: {
  stores: { id: string; number: string; name: string }[];
  today: string;
  positions: string[];
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
            path: String(form.get("path") || ""),
          });
          if ("error" in result && result.error) {
            setError(result.error);
            return;
          }
          if ("id" in result && result.id) router.push(`/trainees/${result.id}`);
        });
      }}
    >
      <EmployeeNameField storeField="storeId" label="Name" />
      <label className="text-sm font-semibold">
        Restaurant
        <select className={`${fieldClass} mt-1`} name="storeId" required defaultValue={stores[0]?.id}>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.number}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold">
        Position
        <PositionSelect name="position" positions={positions} required />
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
        Path
        <select className={`${fieldClass} mt-1`} name="path" required defaultValue="">
          <option value="" disabled>
            Choose a path
          </option>
          <option value="SERVICE">Service</option>
          <option value="PRODUCTION">Production</option>
        </select>
      </label>
      {error ? <p className="text-sm text-brick-dark">{error}</p> : null}
      <button className={primaryButton} disabled={pending} type="submit">
        {pending ? "Adding" : "Create schedule"}
      </button>
      <p className="text-sm text-ink/60">
        Foundation is included for everyone. Service or Production is the rest of this schedule. The other section stays saved and hidden.
      </p>
    </form>
  );
}
