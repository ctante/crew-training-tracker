import Link from "next/link";
import { addModuleAction } from "@/app/actions";
import { ModuleEditor } from "@/components/module-editor";
import { Flash, PageHeader, fieldClass, primaryButton } from "@/components/ui";
import { listModules } from "@/lib/data";
import { one } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modules" };

export default async function ModulesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const language = one(params.lang) === "es" ? "es" : "en";
  const modules = await listModules(language);
  const saved = one(params.saved);
  const notice =
    saved === "added" ? "Module added to Foundation, Service, or Production for every trainee in that section." : "";
  return (
    <div>
      <PageHeader
        kicker="Central path"
        title="Modules"
        description="Add a module, move it within its section, or remove it. A module with saved progress is archived so the history stays. A module with no history is deleted. Order here is the order on every schedule."
        actions={
          <Link href={`/path?lang=${language}`} className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold">
            View path
          </Link>
        }
      />
      <div className="mb-4 flex gap-2">
        <Link href="/admin/modules?lang=en" className={`rounded-full px-4 py-2 text-sm font-semibold ${language === "en" ? "bg-bark text-white" : "border border-line bg-card"}`}>
          English
        </Link>
        <Link href="/admin/modules?lang=es" className={`rounded-full px-4 py-2 text-sm font-semibold ${language === "es" ? "bg-bark text-white" : "border border-line bg-card"}`}>
          Español
        </Link>
      </div>
      <Flash error={one(params.error)} notice={notice} />
      <form action={addModuleAction} className="mb-6 grid gap-3 rounded-3xl border border-line bg-card p-4 shadow-sm sm:grid-cols-2">
        <input type="hidden" name="lang" value={language} />
        <h2 className="font-display text-2xl sm:col-span-2">Add a module</h2>
        <label className="text-sm font-semibold">
          Section
          <select className={`${fieldClass} mt-1`} name="section" defaultValue="FOUNDATION">
            <option value="FOUNDATION">Foundation</option>
            <option value="SERVICE">Service</option>
            <option value="PRODUCTION">Production</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Time
          <input className={`${fieldClass} mt-1`} name="timeLabel" placeholder="10 min" />
        </label>
        <label className="text-sm font-semibold">
          English name
          <input className={`${fieldClass} mt-1`} name="nameEn" required />
        </label>
        <label className="text-sm font-semibold">
          Spanish name
          <input className={`${fieldClass} mt-1`} name="nameEs" required />
        </label>
        <label className="text-sm font-semibold">
          Videos
          <input className={`${fieldClass} mt-1`} name="videoCount" inputMode="numeric" />
        </label>
        <label className="text-sm font-semibold">
          Credit
          <select className={`${fieldClass} mt-1`} name="credit" defaultValue="">
            <option value="">Blank (on the floor)</option>
            <option value="Auto">Auto</option>
            <option value="Manual">Manual</option>
          </select>
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Campus link
          <input className={`${fieldClass} mt-1`} name="link" />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Video titles
          <textarea className={`${fieldClass} mt-1 min-h-16`} name="videoTitles" />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Note
          <textarea className={`${fieldClass} mt-1 min-h-16`} name="note" />
        </label>
        <div className="sm:col-span-2">
          <button className={primaryButton} type="submit">
            Add module
          </button>
        </div>
      </form>
      <ModuleEditor modules={modules} />
    </div>
  );
}
