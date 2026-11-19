import { redirect } from "next/navigation";
import { access, canOpenAdmin } from "@/lib/access";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const who = await access();
  if (!canOpenAdmin(who)) redirect("/");
  return children;
}
