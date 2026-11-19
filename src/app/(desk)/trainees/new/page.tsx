import { redirect } from "next/navigation";
import { NewTraineeForm } from "@/components/new-trainee-form";
import { PageHeader } from "@/components/ui";
import { access, allows } from "@/lib/access";
import { listStoreChoices } from "@/lib/data";
import { todayIso } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Add trainee" };

export default async function NewTraineePage() {
  const who = await access();
  if (!allows(who, "trainees_edit")) redirect("/trainees");
  const stores = await listStoreChoices();
  return (
    <div>
      <PageHeader
        kicker="New path"
        title="Add a trainee"
        description="Choose Service or Production. Everyone also completes Foundation. Progress starts blank."
      />
      <NewTraineeForm stores={stores} today={todayIso()} />
    </div>
  );
}
