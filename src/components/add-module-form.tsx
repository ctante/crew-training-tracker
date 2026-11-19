"use client";

import { useState, useTransition } from "react";
import { addModuleAction, previewSpanishAction } from "@/app/actions";
import { LinkHint, ModuleLinks } from "@/components/module-links";
import { fieldClass, ghostButton, primaryButton } from "@/components/ui";

export function AddModuleForm({ language }: { language: "en" | "es" }) {
  const [open, setOpen] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [nameEs, setNameEs] = useState("");
  const [videoTitles, setVideoTitles] = useState("");
  const [videoTitlesEs, setVideoTitlesEs] = useState("");
  const [link, setLink] = useState("");
  const [spanishSource, setSpanishSource] = useState<"auto" | "manual">("auto");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  function editSpanish(setter: (value: string) => void, value: string) {
    setSpanishSource("manual");
    setter(value);
  }

  if (!open) {
    return (
      <button className={`${primaryButton} mb-6`} type="button" onClick={() => setOpen(true)}>
        Add module
      </button>
    );
  }

  return (
    <form action={addModuleAction} className="mb-6 grid gap-3 rounded-3xl border border-line bg-card p-4 shadow-sm sm:grid-cols-2">
      <input type="hidden" name="lang" value={language} />
      <input type="hidden" name="spanishSource" value={spanishSource} />
      <input type="hidden" name="note" value="" />
      <input type="hidden" name="noteEs" value="" />
      <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
        <h2 className="font-display text-2xl">Add a module</h2>
        <button className={ghostButton} type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <label className="text-sm font-semibold">
        Section
        <select className={`${fieldClass} mt-1`} name="section" defaultValue="FOUNDATION">
          <option value="ORIENTATION">Orientation</option>
          <option value="FOUNDATION">Foundation</option>
          <option value="SERVICE">Service</option>
          <option value="PRODUCTION">Production</option>
        </select>
      </label>
      <label className="text-sm font-semibold">
        Time
        <input className={`${fieldClass} mt-1`} name="timeLabel" placeholder="10 min" />
      </label>
      <label className="text-sm font-semibold sm:col-span-2">
        English name
        <input className={`${fieldClass} mt-1`} name="nameEn" required value={nameEn} onChange={(event) => setNameEn(event.target.value)} />
      </label>
      <label className="text-sm font-semibold">
        Videos
        <input className={`${fieldClass} mt-1`} name="videoCount" inputMode="numeric" />
      </label>
      <label className="text-sm font-semibold">
        Credit
        <select className={`${fieldClass} mt-1`} name="credit" defaultValue="">
          <option value="">Blank (on the floor)</option>
          <option value="Auto">Auto</option>
          <option value="Manual">Manual</option>
        </select>
      </label>
      <label className="text-sm font-semibold sm:col-span-2">
        Link
        <textarea className={`${fieldClass} mt-1 min-h-20`} name="link" value={link} onChange={(event) => setLink(event.target.value)} placeholder="One link per line" />
        <LinkHint />
        {link.trim() ? (
          <div className="mt-3">
            <ModuleLinks link={link} preview />
          </div>
        ) : null}
      </label>
      <label className="text-sm font-semibold sm:col-span-2">
        English video titles
        <textarea className={`${fieldClass} mt-1 min-h-16`} name="videoTitles" value={videoTitles} onChange={(event) => setVideoTitles(event.target.value)} />
      </label>
      <div className="rounded-2xl border border-line bg-paper p-3 sm:col-span-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Spanish text</h3>
          <button
            className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold"
            type="button"
            disabled={pending}
            onClick={() => {
              setStatus("Translating");
              startTransition(async () => {
                const result = await previewSpanishAction({ name: nameEn, videoTitles, note: "" });
                if (!result.ok) {
                  setStatus(result.error);
                  return;
                }
                setNameEs(result.text.name);
                setVideoTitlesEs(result.text.videoTitles);
                setSpanishSource("auto");
                setStatus("Spanish filled in. Edit it if you want different wording.");
              });
            }}
          >
            Fill Spanish
          </button>
        </div>
        <p className="mb-3 text-xs text-ink/60">
          Leave this blank to translate when you add the module. Typing here marks the Spanish text as edited by hand, and later English edits will not replace it.
        </p>
        <div className="grid gap-3">
          <label className="text-sm font-semibold">
            Spanish name
            <input className={`${fieldClass} mt-1`} name="nameEs" value={nameEs} onChange={(event) => editSpanish(setNameEs, event.target.value)} />
          </label>
          <label className="text-sm font-semibold">
            Spanish video titles
            <textarea className={`${fieldClass} mt-1 min-h-16`} name="videoTitlesEs" value={videoTitlesEs} onChange={(event) => editSpanish(setVideoTitlesEs, event.target.value)} />
          </label>
        </div>
        {status ? <p className="mt-2 text-sm text-ink/70">{status}</p> : null}
      </div>
      <div className="sm:col-span-2">
        <button className={primaryButton} type="submit">
          Add module
        </button>
      </div>
    </form>
  );
}
