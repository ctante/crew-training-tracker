import { connection } from "next/server";
import { Shell } from "@/components/shell";
import { access, allows, canOpenAdmin, signedInLabel } from "@/lib/access";
import { countSampleTrainees } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const who = await access();
  const sampleCount = await countSampleTrainees();
  return (
    <Shell
      sampleCount={sampleCount}
      showAdmin={canOpenAdmin(who)}
      showReports={allows(who, "reports")}
      showDevelopment={allows(who, "view_development")}
      showAddTrainee={allows(who, "trainees_edit")}
      signedInLabel={signedInLabel(who)}
    >
      {children}
    </Shell>
  );
}
