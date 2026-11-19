import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { SideNav, TabNav } from "./nav";

export function Shell({
  sampleCount,
  showAdmin,
  signedInLabel,
  children,
}: {
  sampleCount: number;
  showAdmin: boolean;
  signedInLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col bg-bark text-white lg:flex">
        <Link href="/" className="block px-5 pb-2 pt-6">
          <p className="font-display text-xl leading-tight text-sun">Individual Training System (ITS)</p>
          <p className="mt-1 text-sm text-white/70">Signed in · {signedInLabel}</p>
        </Link>
        <SideNav showAdmin={showAdmin} />
        <form action={signOutAction} className="px-5 pb-5">
          <button type="submit" className="text-xs font-semibold text-white/70 underline-offset-2 hover:underline">
            Sign out
          </button>
        </form>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line/80 bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/">
            <p className="font-display text-xl leading-none text-bark">ITS</p>
            <p className="text-xs text-ink/60">Signed in · {signedInLabel}</p>
          </Link>
          <div className="flex items-center gap-3">
            <form action={signOutAction}>
              <button type="submit" className="text-sm font-semibold text-ink/70">
                Sign out
              </button>
            </form>
            <Link href="/trainees/new" className="rounded-full bg-brick px-3 py-2 text-sm font-semibold text-white">
              Add trainee
            </Link>
          </div>
        </header>
        {sampleCount > 0 ? (
          <div className="border-b border-amber-300 bg-sun/70 px-4 py-2 text-sm text-sun-deep lg:px-8">
            <span className="font-semibold">Sample data.</span> People named Sample are fictional. Add a real
            trainee, or restore this set from Admin.
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-6xl px-4 py-5 pb-28 lg:px-8 lg:py-8 lg:pb-12">{children}</main>
      </div>
      <TabNav showAdmin={showAdmin} />
    </div>
  );
}
