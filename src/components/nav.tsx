"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/format";

const links = [
  { href: "/", label: "Board", icon: BoardIcon, match: (path: string) => path === "/" },
  {
    href: "/schedule",
    label: "Schedule",
    icon: CalendarIcon,
    match: (path: string) => path.startsWith("/schedule"),
  },
  {
    href: "/trainees",
    label: "Trainees",
    icon: PeopleIcon,
    match: (path: string) => path.startsWith("/trainees"),
  },
  { href: "/path", label: "Path", icon: PathIcon, match: (path: string) => path.startsWith("/path") },
  { href: "/reports", label: "Reports", icon: ReportIcon, match: (path: string) => path.startsWith("/reports") },
  {
    href: "/admin",
    label: "Admin",
    icon: GearIcon,
    match: (path: string) => path.startsWith("/admin"),
  },
];

export function SideNav({ showAdmin = true, showReports = true }: { showAdmin?: boolean; showReports?: boolean }) {
  const items = links.filter((link) => (link.href === "/admin" ? showAdmin : link.href === "/reports" ? showReports : true));
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Main">
      {items.map((link) => (
        <NavItem key={link.href} {...link} />
      ))}
    </nav>
  );
}

export function TabNav({ showAdmin = true, showReports = true }: { showAdmin?: boolean; showReports?: boolean }) {
  const items = links.filter((link) => (link.href === "/admin" ? showAdmin : link.href === "/reports" ? showReports : true));
  const columns = items.length === 6 ? "grid-cols-6" : items.length === 5 ? "grid-cols-5" : "grid-cols-4";
  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-20 grid border-t border-white/10 bg-bark px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 lg:hidden ${columns}`}
      aria-label="Main"
    >
      {items.map((link) => (
        <NavItem key={link.href} {...link} compact />
      ))}
    </nav>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  match,
  compact = false,
}: {
  href: string;
  label: string;
  icon: () => React.JSX.Element;
  match: (path: string) => boolean;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const active = match(pathname);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex items-center gap-2 rounded-2xl font-semibold transition",
        compact ? "min-h-12 flex-col justify-center gap-0.5 px-1 text-[11px]" : "min-h-11 px-3 text-sm",
        active ? "bg-sun text-bark" : "text-white/80 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon />
      {label}
    </Link>
  );
}

function BoardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="3" width="8" height="5" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="10" width="8" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c.6-3 2.7-4.5 5.5-4.5S14.4 16 15 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16.5 14.5c2.2.3 3.8 1.6 4.3 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PathIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 6h14M5 12h10M5 18h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 19V10M10 19V5M15 19v-6M20 19V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
