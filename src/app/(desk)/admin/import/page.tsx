import Link from "next/link";
import { ImportPanel } from "@/components/import-panel";
import { PageHeader, ghostButton } from "@/components/ui";
import { listStoreChoices } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Import and export" };

export default async function ImportPage() {
  const stores = await listStoreChoices();
  return (
    <div>
      <PageHeader
        kicker="Sheets"
        title="Import and export"
        description="A single ITS tab uses Module, Time, Videos, Credit, Date, Trainer, Completed. A workbook export adds the restaurant and the trainee on every row."
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
