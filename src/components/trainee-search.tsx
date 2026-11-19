"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function TraineeSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (value.trim() === current) return;
    const handle = window.setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      const text = value.trim();
      if (text) next.set("q", text);
      else next.delete("q");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [value, pathname, router, params]);

  return (
    <form
      className="flex min-w-48 flex-1"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams(params.toString());
        const text = value.trim();
        if (text) next.set("q", text);
        else next.delete("q");
        const query = next.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }}
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search name"
        aria-label="Search trainees by name"
        className="min-h-11 w-full rounded-full border border-line bg-card px-4 text-sm"
      />
    </form>
  );
}
