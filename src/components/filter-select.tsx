"use client";

import { useRouter } from "next/navigation";

export function FilterSelect({
  label,
  name,
  value,
  options,
  basePath,
  query,
  clear = [],
}: {
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  basePath: string;
  query: Record<string, string>;
  clear?: string[];
}) {
  const router = useRouter();
  return (
    <label className="block min-w-40 flex-1 text-sm font-semibold">
      {label}
      <select
        className="mt-1 block min-h-11 w-full rounded-2xl border border-line bg-white px-3 text-sm text-ink"
        value={value}
        onChange={(event) => {
          const next = new URLSearchParams();
          for (const [key, item] of Object.entries(query)) {
            if (item && key !== name && !clear.includes(key)) next.set(key, item);
          }
          const chosen = event.target.value;
          if (chosen) next.set(name, chosen);
          if (name === "range" && chosen !== "custom") {
            next.delete("from");
            next.delete("to");
          }
          const text = next.toString();
          router.push(text ? `${basePath}?${text}` : basePath);
        }}
      >
        {options.map((option) => (
          <option key={option.value || "empty"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
