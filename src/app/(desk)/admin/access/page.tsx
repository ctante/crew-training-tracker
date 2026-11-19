import { setStorePasswordAction } from "@/app/actions";
import { Flash, PageHeader, fieldClass, primaryButton } from "@/components/ui";
import { listStoreAccess } from "@/lib/data";
import { one } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Store passwords" };

export default async function StoreAccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const stores = await listStoreAccess();

  return (
    <div>
      <PageHeader
        kicker="Admin"
        title="Store passwords"
        description="Each restaurant signs in with its own password and sees only that restaurant. The admin password still opens every restaurant. A password is not shown again after you save it. Saving a new one signs that restaurant out everywhere."
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
                <input className={`${fieldClass} mt-1`} type="password" name="password" autoComplete="new-password" minLength={8} required />
              </label>
              <label className="text-sm font-semibold">
                Type it again
                <input className={`${fieldClass} mt-1`} type="password" name="confirm" autoComplete="new-password" minLength={8} required />
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
