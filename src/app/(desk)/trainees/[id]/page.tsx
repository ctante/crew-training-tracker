import Link from "next/link";
import { notFound } from "next/navigation";
import { changeLanguageAction, deleteTraineeAction, setTraineePathAction, updateTraineeAction } from "@/app/actions";
import { TraineeEditor } from "@/components/trainee-editor";
import { Flag, Flash, PageHeader, ProgressBar, fieldClass, ghostButton, primaryButton } from "@/components/ui";
import { languageName } from "@/lib/constants";
import { getTrainee } from "@/lib/data";
import { formatMinutes, one, storeLabel, todayIso } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trainee = await getTrainee(id);
  return { title: trainee ? "Individual Training Schedule (ITS)" : "Individual Training Schedule (ITS)" };
}

export default async function TraineePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const trainee = await getTrainee(id);
  if (!trainee) notFound();
  const today = todayIso();
  const saved = one(query.saved);
  const notice =
    saved === "details"
      ? "Schedule details saved."
      : saved === "path"
        ? "Path saved. This schedule shows Foundation plus that section."
        : saved === "language"
          ? "The language was switched. Step progress stayed on the same numbers."
          : "";

  return (
    <div>
      <PageHeader
        kicker={`${storeLabel(trainee.storeNumber)} · ${trainee.name}`}
        title="Individual Training Schedule (ITS)"
        description={`${trainee.path === "SERVICE" ? "Service" : trainee.path === "PRODUCTION" ? "Production" : "Path not chosen"} · ${languageName(trainee.language)}${trainee.position ? ` · ${trainee.position}` : ""} · started ${trainee.startDate}`}
        actions={
          <a href={`/api/export/${trainee.id}`} className={ghostButton}>
            Export ITS
          </a>
        }
      />
      <Flash error={one(query.error)} notice={notice} />
      <div className="mb-4 flex flex-wrap gap-2">
        {trainee.isSample ? <Flag kind="sample">Sample</Flag> : null}
        {trainee.status === "PAUSED" ? <Flag kind="paused">Paused</Flag> : null}
        {trainee.status === "COMPLETED" ? <Flag kind="done">Completed</Flag> : null}
        {trainee.progress.overdueCount > 0 ? <Flag kind="overdue">{trainee.progress.overdueCount} overdue</Flag> : null}
        {trainee.progress.stalled ? <Flag kind="stalled">Stalled</Flag> : null}
        {!trainee.path ? <Flag kind="review">Choose path</Flag> : null}
      </div>

      {!trainee.path ? (
        <form action={setTraineePathAction} className="mb-4 rounded-3xl border border-amber-300 bg-sun/40 p-4">
          <input type="hidden" name="id" value={trainee.id} />
          <p className="font-semibold">Choose path</p>
          <p className="mt-1 text-sm text-ink/70">
            Foundation is on this schedule. Add Service or Production. The other section stays saved and hidden.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={primaryButton} name="path" value="SERVICE" type="submit">
              Service
            </button>
            <button className={primaryButton} name="path" value="PRODUCTION" type="submit">
              Production
            </button>
          </div>
        </form>
      ) : (
        <form action={setTraineePathAction} className="mb-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={trainee.id} />
          <label className="text-sm font-semibold">
            Path
            <select className={`${fieldClass} mt-1`} name="path" defaultValue={trainee.path}>
              <option value="SERVICE">Service</option>
              <option value="PRODUCTION">Production</option>
            </select>
          </label>
          <button className={ghostButton} type="submit">
            Save path
          </button>
        </form>
      )}

      <section className="rounded-3xl border border-line bg-card p-4 shadow-sm">
        <div className="flex items-end justify-between gap-3">
          <p className="font-display text-4xl leading-none">{trainee.progress.percent}%</p>
          <p className="text-sm text-ink/60">
            {trainee.progress.completed}/{trainee.progress.total} · {formatMinutes(trainee.progress.minutesDone)} of{" "}
            {formatMinutes(trainee.progress.minutesTotal)}
          </p>
        </div>
        <div className="mt-3">
          <ProgressBar value={trainee.progress.percent} />
        </div>
        <div className={`mt-4 grid gap-3 ${trainee.progress.sections.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {trainee.progress.sections.map((section) => {
            const percent = section.total ? Math.round((section.completed / section.total) * 100) : 0;
            const title =
              section.section === "FOUNDATION"
                ? trainee.language === "es"
                  ? "Fundación"
                  : "Foundation"
                : section.section === "SERVICE"
                  ? trainee.language === "es"
                    ? "Servicio"
                    : "Service"
                  : trainee.language === "es"
                    ? "Producción"
                    : "Production";
            return (
              <a key={section.section} href={`#${section.section.toLowerCase()}`} className="rounded-2xl bg-paper px-3 py-2">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{title}</span>
                  <span>
                    {section.completed}/{section.total}
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={percent} tone={section.section === "SERVICE" ? "sun" : section.section === "PRODUCTION" ? "moss" : "brick"} />
                </div>
              </a>
            );
          })}
        </div>
      </section>

      <details className="mt-4 rounded-3xl border border-line bg-card p-4">
        <summary className="cursor-pointer font-semibold">Edit trainee, language, or status</summary>
        <form action={updateTraineeAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={trainee.id} />
          <label className="text-sm font-semibold">
            Name
            <input className={`${fieldClass} mt-1`} name="name" defaultValue={trainee.name} required />
          </label>
          <label className="text-sm font-semibold">
            Restaurant
            <select className={`${fieldClass} mt-1`} name="storeId" defaultValue={trainee.storeId}>
              {trainee.stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.number}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Start date
            <input className={`${fieldClass} mt-1`} type="date" name="startDate" defaultValue={trainee.startDate} required />
          </label>
          <label className="text-sm font-semibold">
            Position
            <input className={`${fieldClass} mt-1`} name="position" defaultValue={trainee.position} />
          </label>
          <label className="text-sm font-semibold">
            Path
            <select className={`${fieldClass} mt-1`} name="path" required defaultValue={trainee.path ?? ""}>
              <option value="" disabled>
                Choose a path
              </option>
              <option value="SERVICE">Service</option>
              <option value="PRODUCTION">Production</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Status
            <select className={`${fieldClass} mt-1`} name="status" defaultValue={trainee.status}>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </label>
          <div className="flex items-end">
            <button className={primaryButton} type="submit">
              Save details
            </button>
          </div>
        </form>
        <form action={changeLanguageAction} className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <input type="hidden" name="id" value={trainee.id} />
          <label className="text-sm font-semibold">
            Path language
            <select className={`${fieldClass} mt-1`} name="language" defaultValue={trainee.language}>
              <option value="en">English</option>
              <option value="es">Spanish</option>
            </select>
          </label>
          <button className={ghostButton} type="submit">
            Switch language
          </button>
          <p className="max-w-md text-sm text-ink/60">
            Checks, dates, and trainers stay on the same step number. Names and Campus links change.
          </p>
        </form>
        <form action={deleteTraineeAction} className="mt-4 border-t border-line pt-4">
          <input type="hidden" name="id" value={trainee.id} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" value="yes" className="h-5 w-5 accent-brick" />
            Remove this trainee and their progress.
          </label>
          <button className="mt-2 text-sm font-semibold text-brick" type="submit">
            Remove trainee
          </button>
        </form>
      </details>

      <p className="mt-6 text-sm text-ink/60">
        Campus rows open the training link. Floor rows are hands-on. Credit Auto is recorded by Campus. Credit Manual
        needs a manager to confirm it. Set a date and trainer here to put the session on the store schedule.
      </p>
      <div className="mt-2">
        <Link href="/schedule" className="text-sm font-semibold text-campus">
          Open the schedule
        </Link>
      </div>
      <TraineeEditor modules={trainee.modules} trainers={trainee.trainers} today={today} />
    </div>
  );
}
