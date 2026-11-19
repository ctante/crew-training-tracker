import Link from "next/link";
import { redirect } from "next/navigation";
import { translateMissingAction } from "@/app/actions";
import { AddModuleForm } from "@/components/add-module-form";
import { AdminNav } from "@/components/admin-nav";
import { ModuleEditor } from "@/components/module-editor";
import { Flash, PageHeader, ghostButton } from "@/components/ui";
import { access, allows } from "@/lib/access";
import { listModules } from "@/lib/data";
import { one } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modules" };

export default async function ModulesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const who = await access();
  if (!allows(who, "modules")) redirect("/");
  const params = await searchParams;
  const language = one(params.lang) === "es" ? "es" : "en";
  const modules = await listModules(language);
  const saved = one(params.saved);
  const warning = one(params.warning);
  const notice = [
    saved === "added" ? "Module added for every trainee in that section." : "",
    saved === "translated" ? one(params.notice) : "",
    warning,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      <AdminNav current="/admin/modules" />
      <PageHeader
        kicker="Central path"
        title="Modules"
        description="Add a module, move it within a section, or move it to another section. The Spanish module moves with it, and saved progress stays. A module with no history is deleted. Order here is the order on every schedule."
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
      <div className="mb-4">
        <form action={translateMissingAction}>
          <button className={ghostButton} type="submit">
            Translate missing Spanish
          </button>
        </form>
      </div>
      <Flash error={one(params.error)} notice={notice} />
      <AddModuleForm language={language} />
      <ModuleEditor modules={modules} language={language} />
    </div>
  );
}
