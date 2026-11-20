import Link from "next/link";
import { access, allows } from "@/lib/access";

export async function AdminNav({ current }: { current: string }) {
  const who = await access();
  const links = [
    { href: "/admin", label: "Overview" },
    allows(who, "users") || who.role === "admin" ? { href: "/admin/users", label: "Users" } : null,
    who.role === "admin" ? { href: "/admin/permissions", label: "Role Defaults" } : null,
    allows(who, "store_logins") ? { href: "/admin/access", label: "Store Passwords" } : null,
    allows(who, "roster_import") ? { href: "/admin/roster", label: "Trainer / Manager" } : null,
    who.role === "admin" ? { href: "/admin/employees", label: "Employee Roster" } : null,
    allows(who, "modules") ? { href: "/admin/modules", label: "Modules" } : null,
    allows(who, "roster_import") ? { href: "/admin/import", label: "Bulk Progress" } : null,
    who.role === "admin" ? { href: "/admin/development", label: "Development Activity" } : null,
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  return (
    <nav className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Admin sections">
      {links.map((link) => {
        const active = current === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${
              active ? "border-bark bg-bark text-white" : "border-line bg-card text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
