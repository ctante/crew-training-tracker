import { redirect } from "next/navigation";
import { addEmployeeAction, deactivateEmployeeAction, dismissRosterCorrectionsAction, importEmployeesAction, updateEmployeeAction } from "@/app/actions";
import { AdminNav } from "@/components/admin-nav";
import { CollapsibleSections } from "@/components/collapsible-sections";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { EmployeeNameField } from "@/components/employee-name-field";
import { PositionSelect } from "@/components/position-select";
import { Flash, PageHeader, fieldClass, ghostButton, primaryButton } from "@/components/ui";
import { access } from "@/lib/access";
import { listEmployees, positionChoices, recentRosterNotes } from "@/lib/employees";
import { listStoreChoices } from "@/lib/data";
import { one, storeLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Employee Roster" };

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const who = await access();
  if (who.role !== "admin") redirect("/");
  const params = await searchParams;
  const [people, stores, positions, notes] = await Promise.all([
    listEmployees(),
    listStoreChoices(),
    positionChoices(),
    recentRosterNotes(),
  ]);
  const storeFilter = one(params.store);
  const positionFilter = one(params.position);
  const query = one(params.q).trim().toLowerCase();
  const showInactive = one(params.inactive) === "1";
  const filterPositions = [...new Set(people.map((person) => person.position).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  );
  const shown = people.filter((person) => {
    if (!showInactive && !person.active) return false;
    if (storeFilter && storeFilter !== "all" && person.store.number !== storeFilter) return false;
    if (positionFilter && positionFilter !== "all" && person.position !== positionFilter) return false;
    if (query && !person.name.toLowerCase().includes(query)) return false;
    return true;
  });
  const groups = stores
    .map((store) => ({ store, people: shown.filter((person) => person.storeId === store.id) }))
    .filter((group) => group.people.length > 0);

  return (
    <div>
      <AdminNav current="/admin/employees" />
      <PageHeader
        kicker="Admin"
        title="Employee Roster"
        description="Active employees can be suggested when a name is typed. Inactive employees stay in the database and drop out of the board, trainees, schedule, reports, and development when they are linked."
      />
      <Flash
        error={one(params.error)}
        notice={
          one(params.notice) ||
          (one(params.saved) === "added"
            ? "Employee added."
            : one(params.saved) === "saved"
              ? "Employee saved."
              : one(params.saved) === "inactive"
                ? "Employee marked inactive."
                : "")
        }
      />
      <form action="/admin/employees" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">
          Store
          <select className={`${fieldClass} mt-1`} name="store" defaultValue={storeFilter || "all"}>
            <option value="all">All</option>
            {stores.map((store) => (
              <option key={store.id} value={store.number}>
                {store.number}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Position
          <select className={`${fieldClass} mt-1`} name="position" defaultValue={positionFilter || "all"}>
            <option value="all">All</option>
            {filterPositions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Name
          <input className={`${fieldClass} mt-1`} name="q" defaultValue={one(params.q)} placeholder="Search" />
        </label>
        {showInactive ? <input type="hidden" name="inactive" value="1" /> : null}
        <button className={primaryButton} type="submit">
          Apply
        </button>
        <a className={ghostButton} href={showInactive ? "/admin/employees" : "/admin/employees?inactive=1"}>
          {showInactive ? "Hide Inactive" : "Show Inactive"}
        </a>
      </form>
      <form action={addEmployeeAction} className="mb-6 rounded-3xl border border-line bg-card p-4">
        <h2 className="font-display text-2xl">Add Employee</h2>
        <input type="hidden" name="returnStore" value={storeFilter} />
        <input type="hidden" name="returnPosition" value={positionFilter} />
        <input type="hidden" name="returnQ" value={one(params.q)} />
        {showInactive ? <input type="hidden" name="inactive" value="1" /> : null}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">
            Store
            <select className={`${fieldClass} mt-1`} name="storeId" defaultValue={stores[0]?.id ?? ""} required>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.number}
                </option>
              ))}
            </select>
          </label>
          <EmployeeNameField storeField="storeId" />
          <label className="text-sm font-semibold">
            Position
            <PositionSelect name="position" positions={positions} required />
          </label>
          <button className={primaryButton} type="submit">
            Save Employee
          </button>
        </div>
      </form>
      <details className="mb-6 rounded-3xl border border-line bg-card p-4">
        <summary className="cursor-pointer font-semibold">Import CSV</summary>
        <p className="mt-2 text-sm text-ink/70">
          Columns: Store (or Location), Name (or First Name and Last Name), and Position or Primary Job Title Code Description. A missing position column is rejected. A blank cell does not erase a saved title.
        </p>
        <form action={importEmployeesAction} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="returnStore" value={storeFilter} />
          <input type="hidden" name="returnPosition" value={positionFilter} />
          <input type="hidden" name="returnQ" value={one(params.q)} />
          {showInactive ? <input type="hidden" name="inactive" value="1" /> : null}
          <input className="text-sm" type="file" name="file" accept=".csv,text/csv" required />
          <button className={primaryButton} type="submit">
            Import
          </button>
        </form>
      </details>
      {notes.length ? (
        <section className="mb-6 rounded-3xl border border-line bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl">Recent Roster Corrections</h2>
            <form action={dismissRosterCorrectionsAction}>
              <input type="hidden" name="returnStore" value={storeFilter} />
              <input type="hidden" name="returnPosition" value={positionFilter} />
              <input type="hidden" name="returnQ" value={one(params.q)} />
              {showInactive ? <input type="hidden" name="inactive" value="1" /> : null}
              <button className={ghostButton} type="submit">
                Dismiss
              </button>
            </form>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {notes.map((note) => (
              <li key={note.id}>
                {note.storeNumber}: {note.kind} {note.fromName}
                {note.note.startsWith("ambiguous") ? ` skipped, more than one match (${note.note.replace("ambiguous: ", "")})` : ` → ${note.toName}${note.position ? `, ${note.position}` : ""}`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {groups.length === 0 ? (
        <p className="text-sm text-ink/70">No employees match.</p>
      ) : (
        <CollapsibleSections
          sections={groups.map((group) => ({
            id: group.store.id,
            title: storeLabel(group.store.number),
            count: `${group.people.length} employee${group.people.length === 1 ? "" : "s"}`,
            body: (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="py-2 pr-3 font-semibold">Store</th>
                    <th className="py-2 pr-3 font-semibold">Name</th>
                    <th className="py-2 pr-3 font-semibold">Position</th>
                    <th className="py-2 font-semibold"> </th>
                  </tr>
                </thead>
                <tbody>
                  {group.people.map((person) => (
                    <tr key={person.id} className="border-b border-line/70">
                      <td className="py-2 pr-3 align-top">{person.store.number}</td>
                      <td className="py-2 pr-3 align-top">
                        <form id={`employee-${person.id}`} action={updateEmployeeAction} className="flex flex-wrap gap-2">
                          <input type="hidden" name="id" value={person.id} />
                          <input type="hidden" name="storeId" value={person.storeId} />
                          <input type="hidden" name="returnStore" value={storeFilter} />
                          <input type="hidden" name="returnPosition" value={positionFilter} />
                          <input type="hidden" name="returnQ" value={one(params.q)} />
                          {showInactive ? <input type="hidden" name="inactive" value="1" /> : null}
                          <input className={fieldClass} name="name" defaultValue={person.name} required />
                        </form>
                        {person.active ? "" : <span className="text-xs font-semibold text-ink/50">Inactive</span>}
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <PositionSelect name="position" positions={positions} defaultValue={person.position} form={`employee-${person.id}`} required />
                      </td>
                      <td className="py-2 align-top">
                        <div className="flex flex-wrap gap-2">
                          <button className={ghostButton} type="submit" form={`employee-${person.id}`}>
                            Save
                          </button>
                          {person.active ? (
                            <ConfirmSubmit action={deactivateEmployeeAction} message={`Deactivate ${person.name}? Past training stays.`}>
                              <input type="hidden" name="id" value={person.id} />
                              <input type="hidden" name="returnStore" value={storeFilter} />
                              <input type="hidden" name="returnPosition" value={positionFilter} />
                              <input type="hidden" name="returnQ" value={one(params.q)} />
                              {showInactive ? <input type="hidden" name="inactive" value="1" /> : null}
                              <button className={ghostButton} type="submit">
                                Deactivate
                              </button>
                            </ConfirmSubmit>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ),
          }))}
        />
      )}
    </div>
  );
}
