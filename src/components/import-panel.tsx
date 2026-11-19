"use client";

import { useState, useTransition } from "react";
import { commitImportAction, previewImportAction } from "@/app/actions";
import { fieldClass, ghostButton, primaryButton } from "@/components/ui";
import type { ImportPreview } from "@/lib/data";

export function ImportPanel({
  stores,
}: {
  stores: { id: string; number: string; name: string }[];
}) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [storeNumber, setStoreNumber] = useState(stores[0]?.number ?? "");
  const [trainee, setTrainee] = useState("");
  const [language, setLanguage] = useState("en");
  const [startDate, setStartDate] = useState("");
  const [position, setPosition] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [committed, setCommitted] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function single() {
    return { storeNumber, trainee, language, startDate, position };
  }

  function readFile(file: File) {
    setFileName(file.name);
    file.text().then((text) => {
      setCsv(text);
      setPreview(null);
      setCommitted("");
    });
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold">
        CSV file
        <input
          className="mt-1 block w-full text-sm"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) readFile(file);
          }}
        />
      </label>
      <label className="block text-sm font-semibold">
        Or paste the sheet
        <textarea
          className={`${fieldClass} mt-1 min-h-36 font-mono text-sm`}
          value={csv}
          onChange={(event) => {
            setCsv(event.target.value);
            setPreview(null);
            setCommitted("");
          }}
          placeholder="Module,Time,Videos,Credit,Date,Trainer,Completed"
        />
      </label>
      {fileName ? <p className="text-sm text-ink/60">Loaded {fileName}</p> : null}

      <fieldset className="rounded-3xl border border-line bg-card p-4">
        <legend className="px-1 text-sm font-semibold">For a single ITS tab</legend>
        <p className="mb-3 text-sm text-ink/70">
          Leave these blank when the file already has Store Number and Trainee columns. Fill them when the file is one
          trainee tab: Module, Time, Videos, Credit, Date, Trainer, Completed.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Restaurant
            <select className={`${fieldClass} mt-1`} value={storeNumber} onChange={(event) => setStoreNumber(event.target.value)}>
              {stores.map((store) => (
                <option key={store.id} value={store.number}>
                  {store.number}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Trainee
            <input className={`${fieldClass} mt-1`} value={trainee} onChange={(event) => setTrainee(event.target.value)} />
          </label>
          <label className="text-sm font-semibold">
            Language
            <select className={`${fieldClass} mt-1`} value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="en">English</option>
              <option value="es">Spanish</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Start date
            <input className={`${fieldClass} mt-1`} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Position
            <input className={`${fieldClass} mt-1`} value={position} onChange={(event) => setPosition(event.target.value)} />
          </label>
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={ghostButton}
          disabled={pending || !csv.trim()}
          onClick={() => {
            setError("");
            setCommitted("");
            startTransition(async () => {
              const response = await previewImportAction(csv, single());
              if ("error" in response && response.error) {
                setPreview(null);
                setError(response.error);
                return;
              }
              if ("preview" in response && response.preview) setPreview(response.preview);
            });
          }}
        >
          Preview
        </button>
        <button
          type="button"
          className={primaryButton}
          disabled={pending || !preview || preview.applicable === 0}
          onClick={() => {
            setError("");
            startTransition(async () => {
              const response = await commitImportAction(csv, single());
              if ("error" in response && response.error) {
                setError(response.error);
                return;
              }
              if ("result" in response && response.result) {
                setPreview(response.result);
                const created = response.result.created?.length ?? 0;
                const updated = response.result.updated?.length ?? 0;
                setCommitted(`Imported ${response.result.applicable} module rows. ${created} new trainees, ${updated} updated.`);
              }
            });
          }}
        >
          Import rows
        </button>
      </div>

      {error ? <p className="text-sm text-brick-dark">{error}</p> : null}
      {committed ? <p className="text-sm font-semibold text-moss">{committed}</p> : null}
      {preview ? (
        <div className="rounded-3xl border border-line bg-card p-4 text-sm">
          <p>
            {preview.mode === "bulk" ? "Bulk file" : "Single ITS tab"} · {preview.readRows} rows · {preview.applicable}{" "}
            ready · {preview.trainees} trainees · {preview.unmatched} unmatched
          </p>
          {preview.unmatched > preview.issues.length ? (
            <p className="mt-1 text-ink/60">Showing the first {preview.issues.length} unmatched rows.</p>
          ) : null}
          {preview.sample.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {preview.sample.map((row) => (
                <li key={`${row.trainee}-${row.module}`}>
                  {row.trainee ? `${row.trainee}: ` : ""}
                  {row.module}
                  {row.date ? ` · ${row.date}` : ""}
                  {row.trainer ? ` · ${row.trainer}` : ""} · {row.completed}
                </li>
              ))}
            </ul>
          ) : null}
          {preview.issues.length > 0 ? (
            <div className="mt-3">
              <p className="font-semibold text-brick-dark">Unmatched rows</p>
              <ul className="mt-1 space-y-1 text-brick-dark">
                {preview.issues.map((issue) => (
                  <li key={`${issue.row}-${issue.message}`}>
                    Row {issue.row}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
