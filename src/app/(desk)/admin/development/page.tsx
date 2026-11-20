import { addDevelopmentTaskAction, removeDevelopmentTaskAction, renameDevelopmentTaskAction } from "@/app/actions";
import { AdminNav } from "@/components/admin-nav";
import { Flash, PageHeader, fieldClass, ghostButton, primaryButton } from "@/components/ui";
import { listDevelopmentTasks } from "@/lib/development";
import { one } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Training needed" };

export default async function DevelopmentTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tasks = await listDevelopmentTasks();

  return (
    <div>
      <AdminNav current="/admin/development" />
      <PageHeader
        kicker="Admin"
        title="Training needed"
        description="These choices appear in the Training Needed dropdown on the development week. Renaming updates weeks that already use that name. Removing takes it off the list and leaves the old text on past weeks."
      />
      <Flash error={one(params.error)} notice={one(params.saved) ? "Training needed list saved." : ""} />
      <form action={addDevelopmentTaskAction} className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">
          New option
          <input className={`${fieldClass} mt-1`} name="label" required />
        </label>
        <button className={primaryButton} type="submit">
          Add
        </button>
      </form>
      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="flex flex-wrap items-end gap-3 rounded-3xl border border-line bg-card p-4">
            <form action={renameDevelopmentTaskAction} className="flex flex-1 flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={task.id} />
              <label className="min-w-64 flex-1 text-sm font-semibold">
                Name
                <input className={`${fieldClass} mt-1`} name="label" defaultValue={task.label} required />
              </label>
              <button className={primaryButton} type="submit">
                Rename
              </button>
            </form>
            <form action={removeDevelopmentTaskAction}>
              <input type="hidden" name="id" value={task.id} />
              <button className={ghostButton} type="submit">
                Remove
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
