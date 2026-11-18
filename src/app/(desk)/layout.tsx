import { connection } from "next/server";
import { Shell } from "@/components/shell";
import { countSampleTrainees } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const sampleCount = await countSampleTrainees();
  return <Shell sampleCount={sampleCount}>{children}</Shell>;
}
