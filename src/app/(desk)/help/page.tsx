import { CollapsibleSections } from "@/components/collapsible-sections";
import { HelpVideo } from "@/components/help-video";
import { PageHeader } from "@/components/ui";
import { access } from "@/lib/access";
import { HELP_GUIDES, helpRoleId } from "@/lib/help";

export const dynamic = "force-dynamic";

export const metadata = { title: "Help" };

export default async function HelpPage() {
  const who = await access();
  const mine = helpRoleId(who.role);
  const guides =
    who.role === "admin"
      ? [...HELP_GUIDES.filter((guide) => guide.id === mine), ...HELP_GUIDES.filter((guide) => guide.id !== mine)]
      : HELP_GUIDES.filter((guide) => guide.id === mine);

  return (
    <div>
      <PageHeader
        kicker="Help"
        title="How To Use The Site"
        description={
          who.role === "admin"
            ? "A short video for each role. Your role is first. Open the others when you cover a shift."
            : "A short video for your role."
        }
      />
      <CollapsibleSections
        startOpen={[mine]}
        sections={guides.map((guide) => ({
          id: guide.id,
          title: guide.id === mine ? `${guide.title} · Your Role` : guide.title,
          count: `${guide.steps.length} steps`,
          emphasis: guide.id === mine,
          body: (
            <div className="grid gap-4">
              <p className="text-sm text-ink/75">{guide.summary}</p>
              <HelpVideo src={guide.video} poster={guide.poster} captions={guide.captions} />
              <div>
                <h3 className="font-display text-2xl">Walkthrough</h3>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                  {guide.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          ),
        }))}
      />
    </div>
  );
}
