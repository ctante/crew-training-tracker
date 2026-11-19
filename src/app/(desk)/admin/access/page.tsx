import { redirect } from "next/navigation";
import { setStorePasswordAction } from "@/app/actions";
import { AdminNav } from "@/components/admin-nav";
import { Flash, PageHeader, fieldClass, primaryButton } from "@/components/ui";
import { access, allows } from "@/lib/access";
import { listStoreAccess } from "@/lib/data";
import { one } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Store passwords" };

export default async function StoreAccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const who = await access();
  if (!allows(who, "store_logins")) redirect("/");
  const params = await searchParams;
  const stores = await listStoreAccess();

  return (
    <div>
      <AdminNav current="/admin/access" />
      <PageHeader
        kicker="Admin"
        title="Store passwords"
        description="Each restaurant has a shared User account. The username is the restaurant number. People can also leave the username blank and enter this password. Saving a new password signs that restaurant out. The password is not shown again."
      />
      <Flash error={one(params.error)} notice={one(params.saved) ? "Password saved. It will not be shown again." : ""} />
      <div className="space-y-4">
        {stores.map((store) => (
          <section key={store.id} id={`store-${store.id}`} className="scroll-mt-24 rounded-3xl border border-line bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl">{store.number}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${store.hasPassword ? "bg-moss/15 text-moss" : "bg-sun text-sun-deep"}`}>
                {store.hasPassword ? "Password set" : "No password"}
              </span>
            </div>
            <form action={setStorePasswordAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <input type="hidden" name="storeId" value={store.id} />
              <label className="text-sm font-semibold">
                New password
                <input className={`${fieldClass} mt-1`} type="password" name="password" autoComplete="new-password" required />
              </label>
              <label className="text-sm font-semibold">
                Type it again
                <input className={`${fieldClass} mt-1`} type="password" name="confirm" autoComplete="new-password" required />
              </label>
              <button className={primaryButton} type="submit">
                {store.hasPassword ? "Reset password" : "Set password"}
              </button>
            </form>
          </section>
        ))}
      </div>
    </div>
  );
}
