import { redirect } from "next/navigation";
import { setStorePasswordAction } from "@/app/actions";
import { AdminNav } from "@/components/admin-nav";
import { CollapsibleSections } from "@/components/collapsible-sections";
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
        title="Store Passwords"
        description="Each restaurant has a shared User account. The username is the restaurant number. People can also leave the username blank and enter this password. Saving a new password signs that restaurant out. The password is not shown again."
      />
      <Flash error={one(params.error)} notice={one(params.saved) ? "Password saved. It will not be shown again." : ""} />
      <CollapsibleSections
        sections={stores.map((store) => ({
          id: store.id,
          title: store.number,
          count: store.hasPassword ? "Password set" : "No password",
          body: (
            <form action={setStorePasswordAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
          ),
        }))}
      />
    </div>
  );
}
