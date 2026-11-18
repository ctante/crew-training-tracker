import { NewTraineeForm } from "@/components/new-trainee-form";
import { PageHeader } from "@/components/ui";
import { listStoreChoices } from "@/lib/data";
import { todayIso } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Add trainee" };

export default async function NewTraineePage() {
  const stores = await listStoreChoices();
  return (
    <div>
      <PageHeader
        kicker="New path"
        title="Add a trainee"
        description="The language chooses the English or Spanish copy of the 36 modules. Progress starts blank."
      />
      <NewTraineeForm stores={stores} today={todayIso()} />
    </div>
  );
}
