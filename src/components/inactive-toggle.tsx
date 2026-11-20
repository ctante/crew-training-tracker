import Link from "next/link";
import { ghostButton } from "@/components/ui";
import { withParams } from "@/lib/format";

export function InactiveToggle({
  admin,
  on,
  path,
  query,
}: {
  admin: boolean;
  on: boolean;
  path: string;
  query: Record<string, string>;
}) {
  if (!admin) return null;
  return (
    <Link className={ghostButton} href={withParams(path, query, { inactive: on ? null : "1" })}>
      {on ? "Hide Inactive" : "Show Inactive"}
    </Link>
  );
}
