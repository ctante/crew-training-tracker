import Link from "next/link";
import { ModuleEditor } from "@/components/module-editor";
import { PageHeader } from "@/components/ui";
import { listModules } from "@/lib/data";
import { one } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit modules" };

export default async function ModulesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const language = one((await searchParams).lang) === "es" ? "es" : "en";
  const modules = await listModules(language);
  return (
    <div>
      <PageHeader
        kicker="Central path"
        title="Edit modules and links"
        description="This is the only copy. Trainee pages read these names, times, video titles, and Campus links."
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
      <ModuleEditor modules={modules} />
    </div>
  );
}
