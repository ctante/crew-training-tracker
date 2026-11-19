import { connection } from "next/server";
import { Shell } from "@/components/shell";
import { access } from "@/lib/access";
import { countSampleTrainees } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const who = await access();
  const sampleCount = await countSampleTrainees();
  return (
    <Shell
      sampleCount={sampleCount}
      showAdmin={who.role === "admin"}
      signedInLabel={who.role === "store" ? who.storeNumber : "All restaurants"}
    >
      {children}
    </Shell>
  );
}
