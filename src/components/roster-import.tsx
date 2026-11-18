"use client";

import { useState, useTransition } from "react";
import { commitRosterAction, previewRosterAction, syncGoogleRosterAction } from "@/app/actions";
import { fieldClass, ghostButton, primaryButton } from "@/components/ui";

type Preview = {
  qualifiedColumn: boolean;
  rows: { rowNumber: number; name: string; storeNumber: string; position: string; qualified: boolean }[];
  issues: { row: number; message: string }[];
};

export function RosterImport() {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold">
        Development Report CSV
        <input
          className="mt-1 block w-full text-sm"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            file.text().then((text) => {
              setCsv(text);
              setPreview(null);
              setMessage("");
              setError("");
            });
          }}
        />
      </label>
      <label className="block text-sm font-semibold">
        Or paste the roster
        <textarea
          className={`${fieldClass} mt-1 min-h-32 font-mono text-sm`}
          value={csv}
          onChange={(event) => {
            setCsv(event.target.value);
            setPreview(null);
            setMessage("");
          }}
          placeholder="Name,Store,Position,Qualified"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={ghostButton}
          disabled={pending || !csv.trim()}
          onClick={() => {
            setError("");
            setMessage("");
            startTransition(async () => {
              const response = await previewRosterAction(csv);
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
          disabled={pending || !preview || preview.rows.length === 0}
          onClick={() => {
            setError("");
            startTransition(async () => {
              const response = await commitRosterAction(csv);
              if ("error" in response && response.error) {
                setError(response.error);
                return;
              }
              if ("result" in response && response.result) {
                const result = response.result;
                setMessage(
                  `Roster updated. ${result.createdCount} added, ${result.updatedCount} updated, ${result.skippedCount} skipped.`,
                );
                setPreview(null);
              }
            });
          }}
        >
          Update roster
        </button>
      </div>
      {error ? <p className="text-sm text-brick-dark">{error}</p> : null}
      {message ? <p className="text-sm font-semibold text-moss">{message}</p> : null}
      {preview ? (
        <div className="rounded-3xl border border-line bg-card p-4 text-sm">
          <p>
            {preview.rows.length} people ready
            {preview.qualifiedColumn ? "" : " · no Qualified column, so everyone is treated as qualified"}
            {preview.issues.length ? ` · ${preview.issues.length} skipped` : ""}
          </p>
          <ul className="mt-2 space-y-1">
            {preview.rows.slice(0, 8).map((row) => (
              <li key={`${row.rowNumber}-${row.name}`}>
                {row.storeNumber} · {row.name} · {row.position || "No position"} · {row.qualified ? "Qualified" : "Not qualified"}
              </li>
            ))}
          </ul>
          {preview.issues.length > 0 ? (
            <ul className="mt-2 space-y-1 text-brick-dark">
              {preview.issues.slice(0, 8).map((issue) => (
                <li key={`${issue.row}-${issue.message}`}>
                  Row {issue.row}: {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <form
        className="rounded-3xl border border-line bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          setMessage("");
          startTransition(async () => {
            const response = await syncGoogleRosterAction();
            if ("error" in response && response.error) {
              setError(response.error);
              return;
            }
            if ("result" in response && response.result) {
              setMessage(
                `Sheet sync finished. ${response.result.createdCount} added, ${response.result.updatedCount} updated.`,
              );
            }
          });
        }}
      >
        <h2 className="font-display text-2xl">Google Sheets</h2>
        <p className="mt-1 text-sm text-ink/70">
          The sync button calls the Development Report adapter. Until a sheet URL or the Sheets API is connected, it
          explains how to plug that in.
        </p>
        <button className={`${ghostButton} mt-3`} type="submit" disabled={pending}>
          Sync Development Report
        </button>
      </form>
    </div>
  );
}
