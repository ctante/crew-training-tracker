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
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-8">
      <div aria-hidden className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(/signin-bg.jpg)" }} />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/75" />
      <div className="relative w-full max-w-md rounded-3xl border border-white bg-white p-6 text-ink shadow-2xl sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brick">Individual Training System (ITS)</p>
        <h1 className="mt-2 font-display text-4xl text-ink">Team sign-in</h1>
        <p className="mt-2 text-sm leading-6 text-ink/80">
          Use the admin password, or the password for your restaurant. Ask the person who set up the site if you need it.
        </p>
        <LoginForm nextPath={safeNextPath(nextValue)} />
      </div>
    </main>
  );
}
