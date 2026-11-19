import Link from "next/link";
import { ModuleLinks } from "@/components/module-links";
import { Flag, PageHeader } from "@/components/ui";
import { BLOCKS, CAMPUS_HOME, blockFor } from "@/lib/constants";
import { listModules } from "@/lib/data";
import { formatMinutes, one, splitTitles } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Training path" };

export default async function PathPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const language = one((await searchParams).lang) === "es" ? "es" : "en";
  const modules = (await listModules(language)).filter((module) => !module.archived);
  const review = modules.filter((module) => module.needsReview);

  return (
    <div>
      <PageHeader
        kicker="One central copy"
        title={language === "es" ? "Ruta en español" : "English training path"}
        description="Catalog order starts with Orientation, then Foundation, then Service or Production. A trainee schedule shows Orientation and Foundation plus the path they chose."
        actions={
          <Link href={`/admin/modules?lang=${language}`} className="inline-flex min-h-11 items-center rounded-full bg-brick px-4 text-sm font-semibold text-white">
            Edit modules
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/path?lang=en" className={`rounded-full px-4 py-2 text-sm font-semibold ${language === "en" ? "bg-bark text-white" : "bg-card border border-line"}`}>
          English
        </Link>
        <Link href="/path?lang=es" className={`rounded-full px-4 py-2 text-sm font-semibold ${language === "es" ? "bg-bark text-white" : "bg-card border border-line"}`}>
          Español
        </Link>
        <a href={CAMPUS_HOME} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold text-campus">
          Campus library
        </a>
      </div>
      {review.length > 0 ? (
        <p className="mb-4 rounded-2xl border border-amber-300 bg-sun/60 px-4 py-3 text-sm text-sun-deep">
          Needs review: {review.map((module) => module.name).join(" and ")}. Those links contain a personal regId.
        </p>
      ) : null}
      <p className="mb-4 text-sm text-ink/65">
        Blue Campus rows are online. Black-ink floor rows are hands-on. Block times ({BLOCKS.map((block) => block.hours).filter((value, index, list) => list.indexOf(value) === index).join(", ")}) are the estimates written in column A of the sheet, separate from adding up each row.
      </p>
      <ol className="space-y-3">
        {modules.map((module, index) => {
          const showSection = module.section !== modules[index - 1]?.section;
          const block = blockFor(module.sortOrder);
          const titles = splitTitles(module.videoTitles);
          const start = block && block.from === module.sortOrder;
          return (
            <li key={module.id}>
              {showSection ? <h2 className="mb-2 mt-6 font-display text-2xl first:mt-0">{module.sectionTitle}</h2> : null}
              {start ? (
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
                  Sheet block {block.hours}
                </p>
              ) : null}
              <article className="rounded-3xl border border-line bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-ink/45">
                      {String(module.sortOrder).padStart(2, "0")}
                      {module.timeLabel ? ` · ${module.timeLabel}` : ""}
                      {module.timeMinutes ? ` · ${formatMinutes(module.timeMinutes)}` : ""}
                      {module.videoCount ? ` · ${module.videoCount} videos` : ""}
                    </p>
                    <h3 className="text-lg font-semibold">{module.name}</h3>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Flag kind={module.kind === "campus" ? "campus" : module.kind === "app" ? "app" : "floor"}>
                      {module.kind === "campus" ? "Campus" : module.kind === "app" ? "App check" : "On the floor"}
                    </Flag>
                    {module.credit ? <Flag kind={module.credit === "Auto" ? "auto" : "manual"}>{module.credit}</Flag> : null}
                    {module.needsReview ? <Flag kind="review">Needs review</Flag> : null}
                  </div>
                </div>
                <div className="mt-2">
                  <ModuleLinks link={module.link} empty="No Campus link" />
                  {titles.length > 0 ? (
                    <details>
                      <summary className="cursor-pointer font-semibold">Video titles</summary>
                      <ul className="mt-1 list-disc pl-5 text-ink/75">
                        {titles.map((title) => (
                          <li key={title}>{title}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
