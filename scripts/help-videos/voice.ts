import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SPEAK = path.join(ROOT, "scripts/help-videos/speak.py");
const VENV_PYTHON = path.join(ROOT, "scripts/help-videos/.venv/bin/python");
const LOCAL_PYTHON = "/tmp/kokoro-venv/bin/python";

export const VOICE = "af_heart";
export const VOICE_ENGINE = "Kokoro (kokoro-onnx)";

export function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
  });
}

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function pythonCanSpeak(python: string) {
  if (!(await exists(python))) return false;
  return new Promise<boolean>((resolve) => {
    const child = spawn(python, ["-c", "import kokoro_onnx, soundfile"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

export async function voicePython() {
  if (process.env.HELP_PYTHON && (await pythonCanSpeak(process.env.HELP_PYTHON))) return process.env.HELP_PYTHON;
  if (await pythonCanSpeak(VENV_PYTHON)) return VENV_PYTHON;
  if (await pythonCanSpeak(LOCAL_PYTHON)) return LOCAL_PYTHON;
  await run("python3", ["-m", "venv", path.dirname(path.dirname(VENV_PYTHON))]);
  await run(VENV_PYTHON, ["-m", "pip", "install", "kokoro-onnx", "soundfile"]);
  return VENV_PYTHON;
}

export async function synthesize(dir: string, groups: { id: string; lines: string[] }[]) {
  await mkdir(dir, { recursive: true });
  const python = await voicePython();
  const job = path.join(dir, "render.json");
  await writeFile(job, JSON.stringify({ dir, groups, voice: VOICE, speed: 1 }));
  await run(python, [SPEAK, "render", job]);
  const durations = JSON.parse(await readFile(path.join(dir, "durations.json"), "utf8")) as Record<string, number[]>;
  return durations;
}

export async function placeVoice(cues: { file: string; start: number }[], duration: number, out: string) {
  const python = await voicePython();
  const job = `${out}.json`;
  await writeFile(job, JSON.stringify({ cues, duration, out }));
  await run(python, [SPEAK, "place", job]);
}

export function probe(file: string) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve(Number(out.trim())) : reject(new Error(`ffprobe exited ${code}`))));
  });
}

export function stamp(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}.${String(ms % 1000).padStart(3, "0")}`;
}

export function vtt(cues: { line: string; start: number; end: number }[]) {
  const lines = ["WEBVTT", ""];
  for (const cue of cues) {
    lines.push(`${stamp(cue.start)} --> ${stamp(cue.end)}`, cue.line, "");
  }
  return lines.join("\n");
}

export async function muxNarration(raw: string, voiceWav: string, out: string) {
  const duration = await probe(raw);
  await run("ffmpeg", [
    "-y",
    "-i",
    raw,
    "-i",
    voiceWav,
    "-f",
    "lavfi",
    "-t",
    duration.toFixed(3),
    "-i",
    "sine=frequency=196:sample_rate=48000",
    "-filter_complex",
    "[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[voice];[2:a]volume=0.018[bed];[voice][bed]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[a]",
    "-map",
    "0:v:0",
    "-map",
    "[a]",
    "-t",
    duration.toFixed(3),
    "-r",
    "12",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "veryfast",
    "-crf",
    "30",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ac",
    "2",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    out,
  ]);
}

export async function poster(video: string, at: number, jpg: string) {
  await run("ffmpeg", ["-y", "-ss", Math.max(0.2, at).toFixed(3), "-i", video, "-frames:v", "1", "-update", "1", jpg]);
}

export async function publishNarration(options: {
  rawPath: string;
  wallStart: number;
  wallEnd: number;
  cues: { line: string; at: number; file: string }[];
  out: string;
  posterPath?: string;
  vttPath?: string;
  workDir: string;
}) {
  const duration = await probe(options.rawPath);
  const elapsed = (options.wallEnd - options.wallStart) / 1000;
  const offset = elapsed - duration;
  console.log(`video ${duration.toFixed(2)}s, clock ${elapsed.toFixed(2)}s, offset ${offset.toFixed(2)}s`);
  const timed = options.cues.map((cue, index) => {
    const start = Math.max(0, cue.at - Math.max(0, offset));
    const next = options.cues[index + 1];
    const end = next ? Math.max(start + 0.3, next.at - Math.max(0, offset)) : duration;
    return { line: cue.line, file: cue.file, start, end: Math.min(duration, Math.max(start + 0.3, end)) };
  });
  const voiceWav = path.join(options.workDir, "voice.wav");
  await placeVoice(
    timed.map((cue) => ({ file: cue.file, start: cue.start })),
    duration,
    voiceWav,
  );
  await muxNarration(options.rawPath, voiceWav, options.out);
  if (options.vttPath) await writeFile(options.vttPath, vtt(timed));
  if (options.posterPath) await poster(options.out, timed[1]?.start ?? timed[0]?.start ?? 1, options.posterPath);
}

export function holdSeconds(speech: number) {
  return Math.max(speech + 0.9, 4.8);
}
