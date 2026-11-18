import Link from "next/link";
import { SideNav, TabNav } from "./nav";

export function Shell({
  sampleCount,
  children,
}: {
  sampleCount: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col bg-bark text-white lg:flex">
        <Link href="/" className="block px-5 pb-2 pt-6">
          <p className="font-display text-2xl leading-none text-sun">Crew Training</p>
          <p className="mt-1 text-sm text-white/70">Tracker · 10 restaurants</p>
        </Link>
        <SideNav />
        <p className="px-5 pb-5 text-xs leading-5 text-white/55">
          Shared desk for general managers and crew trainers. No sign-in on this prototype.
        </p>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line/80 bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/">
            <p className="font-display text-xl leading-none text-bark">Crew Training</p>
            <p className="text-xs text-ink/60">Tracker</p>
          </Link>
          <Link href="/trainees/new" className="rounded-full bg-brick px-3 py-2 text-sm font-semibold text-white">
            Add trainee
          </Link>
        </header>
        {sampleCount > 0 ? (
          <div className="border-b border-amber-300 bg-sun/70 px-4 py-2 text-sm text-sun-deep lg:px-8">
            <span className="font-semibold">Sample data.</span> People named Sample are fictional. Add a real
            trainee, or restore this set from Admin.
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-6xl px-4 py-5 pb-28 lg:px-8 lg:py-8 lg:pb-12">{children}</main>
      </div>
      <TabNav />
    </div>
  );
}
