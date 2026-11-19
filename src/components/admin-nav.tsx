import Link from "next/link";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/access", label: "Store passwords" },
  { href: "/admin/roster", label: "Trainer roster" },
  { href: "/admin/modules", label: "Modules" },
  { href: "/admin/import", label: "Bulk progress" },
];

export function AdminNav({ current }: { current: string }) {
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
