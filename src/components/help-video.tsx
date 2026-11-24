"use client";

import { useState } from "react";

export function HelpVideo({ src, poster, captions }: { src: string; poster: string; captions: string }) {
  const [on, setOn] = useState(false);

  function apply(video: HTMLVideoElement, showing: boolean) {
    for (const track of video.textTracks) {
      if (track.kind === "captions" || track.kind === "subtitles") {
        track.mode = showing ? "showing" : "hidden";
      }
    }
  }

  return (
    <div className="relative">
      <video
        className="w-full rounded-2xl bg-bark"
        controls
        playsInline
        preload="metadata"
        poster={poster}
        onLoadedMetadata={(event) => apply(event.currentTarget, on)}
        onPlay={(event) => apply(event.currentTarget, on)}
      >
        <source src={src} type="video/mp4" />
        <track kind="captions" src={captions} srcLang="en" label="English" />
      </video>
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? "Turn captions off" : "Turn captions on"}
        className={`absolute right-3 top-3 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-bold tracking-wide shadow-sm ${
          on ? "border-bark bg-bark text-white" : "border-line bg-white/95 text-bark"
        }`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const video = event.currentTarget.parentElement?.querySelector("video");
          if (!video) return;
          const next = !on;
          apply(video, next);
          setOn(next);
        }}
      >
        CC
      </button>
    </div>
  );
}
