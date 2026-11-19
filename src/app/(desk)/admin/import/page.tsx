import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { ImportPanel } from "@/components/import-panel";
import { PageHeader, ghostButton } from "@/components/ui";
import { access, allows } from "@/lib/access";
import { listStoreChoices } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Import and export" };

export default async function ImportPage() {
  const who = await access();
  if (!allows(who, "roster_import")) redirect("/");
  const stores = await listStoreChoices();
  return (
    <div>
      <AdminNav current="/admin/import" />
      <PageHeader
        kicker="Sheets"
        title="Import and export"
        description="A bulk sheet uses Store Number, Trainee, Language, Start Date, Section, Module, Time, Date, Trainer, Completed. Language and Time pick the right module when the name is shared by a video and a floor session. A single ITS tab uses Module, Time, Videos, Credit, Date, Trainer, Completed."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <a className={ghostButton} href="/api/export" download>
          Export all progress
        </a>
        <a className={ghostButton} href="/api/export/template?lang=en" download>
          English blank ITS
        </a>
        <a className={ghostButton} href="/api/export/template?lang=es" download>
          Spanish blank ITS
        </a>
        <Link className={ghostButton} href="/trainees">
          Export one trainee from their page
        </Link>
      </div>
      <ImportPanel stores={stores} />
    </div>
  );
}
