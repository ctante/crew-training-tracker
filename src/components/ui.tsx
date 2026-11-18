import { cx } from "@/lib/format";

export const fieldClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-base text-ink shadow-sm outline-none focus:border-brick";

export const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-brick px-4 py-2 text-sm font-semibold text-white transition hover:bg-brick-dark disabled:opacity-60";

export const ghostButton =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold text-ink transition hover:border-brick/40";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        {kicker ? (
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brick">{kicker}</p>
        ) : null}
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
        {description ? <p className="mt-1 text-sm leading-6 text-ink/70">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "brick",
}: {
  value: number;
  tone?: "brick" | "sun" | "moss";
}) {
  const fill = tone === "sun" ? "bg-sun" : tone === "moss" ? "bg-moss" : "bg-brick";
  return (
    <div className="h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden>
      <div className={cx("h-full rounded-full", fill)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Flag({
  kind,
  children,
}: {
  kind: "overdue" | "stalled" | "today" | "paused" | "done" | "sample" | "review" | "campus" | "floor" | "app" | "auto" | "manual";
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    overdue: "bg-red-100 text-brick-dark",
    stalled: "bg-sun text-sun-deep",
    today: "bg-amber-100 text-sun-deep",
    paused: "bg-ink/10 text-ink/80",
    done: "bg-moss/15 text-moss",
    sample: "bg-ink/5 text-ink/60",
    review: "bg-sun text-sun-deep",
    campus: "bg-campus/10 text-campus",
    floor: "bg-ink/10 text-ink",
    app: "bg-amber-100 text-sun-deep",
    auto: "bg-campus/10 text-campus",
    manual: "bg-sun text-sun-deep",
  };
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", styles[kind])}>
      {children}
    </span>
  );
}

export function Flash({ error, notice }: { error?: string; notice?: string }) {
  if (error) {
    return (
      <p className="mb-4 rounded-2xl border border-brick/30 bg-red-50 px-4 py-3 text-sm text-brick-dark" role="alert">
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p className="mb-4 rounded-2xl border border-amber-300 bg-sun/50 px-4 py-3 text-sm text-sun-deep">{notice}</p>
    );
  }
  return null;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-card/70 px-5 py-10 text-center text-sm text-ink/70">
      {children}
    </div>
  );
}
