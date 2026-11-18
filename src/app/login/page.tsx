import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LoginForm } from "./login-form";
import { SESSION_COOKIE, safeNextPath, verifySessionToken } from "@/lib/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const jar = await cookies();
  if (await verifySessionToken(jar.get(SESSION_COOKIE)?.value)) redirect("/");
  const params = await searchParams;
  const nextValue = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brick">Crew Training Tracker</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Team sign-in</h1>
      <p className="mt-2 text-sm leading-6 text-ink/70">
        General managers and crew trainers share one password. Ask the person who set up the site if you need it.
      </p>
      <div className="mt-2 rounded-3xl border border-line bg-card p-5 shadow-sm">
        <LoginForm nextPath={safeNextPath(nextValue)} />
      </div>
    </main>
  );
}
