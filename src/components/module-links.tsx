"use client";

import { useState } from "react";
import { parseModuleLinks } from "@/lib/drive";

export function ModuleLinks({
  link,
  preview = false,
  empty = "Hands-on session. Schedule a trainer and a date.",
}: {
  link: string;
  preview?: boolean;
  empty?: string;
}) {
  const parsed = parseModuleLinks(link);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!link.trim()) {
    return preview ? null : <span className="text-sm text-ink/55">{empty}</span>;
  }
  if (parsed.files.length === 0 && parsed.folders.length === 0 && parsed.other.length === 0) {
    return <span className="text-sm text-ink/55">No link yet.</span>;
  }
  return (
    <div className="w-full space-y-3">
      {parsed.files.map((file, index) => (
        <div key={file.id}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-full bg-campus px-4 text-sm font-semibold text-white"
              onClick={() => setOpenId(openId === file.id ? null : file.id)}
            >
              {openId === file.id ? "Hide video" : parsed.files.length > 1 ? `Watch video ${index + 1}` : "Watch video"}
            </button>
            <a href={file.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-campus">
              Open in Drive
            </a>
          </div>
          {openId === file.id ? (
            <div className="relative mt-2 w-full overflow-hidden rounded-2xl bg-black" style={{ paddingTop: "56.25%" }}>
              <iframe
                className="absolute inset-0 h-full w-full"
                src={file.embed}
                title={parsed.files.length > 1 ? `Training video ${index + 1}` : "Training video"}
                allow="fullscreen"
                allowFullScreen
              />
            </div>
          ) : null}
        </div>
      ))}
      {parsed.folders.map((folder) => (
        <a
          key={folder.id}
          href={folder.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink"
        >
          Open folder
        </a>
      ))}
      {parsed.other.map((href) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-full bg-campus px-4 text-sm font-semibold text-white"
        >
          Open module
        </a>
      ))}
    </div>
  );
}

export function LinkHint() {
  return (
    <p className="mt-1 text-xs font-normal text-ink/60">
      Paste a Campus link or a Google Drive video link (share as Anyone with the link).
    </p>
  );
}
