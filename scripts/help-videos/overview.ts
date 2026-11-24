import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium, type Page } from "playwright";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RAW = path.join(ROOT, "tmp/help-raw");
const BASE = process.env.HELP_BASE_URL ?? "http://127.0.0.1:3010";
const STEP_MS = 12000;
const ARTIFACT = "/opt/cursor/artifacts/ITS_Overview.mp4";

const SCENES: { title: string; line: string; run?: (page: Page) => Promise<void> }[] = [
  {
    title: "Individual Training System",
    line: "This is the Individual Training System. One place for crew training across every restaurant.",
  },
  {
    title: "The Problem",
    line: "Training used to live in a separate Google Sheet at each restaurant. Dates slipped, and nobody could see the whole group.",
  },
  {
    title: "One Sign-In",
    line: "A manager, a supervisor, or an admin signs in and sees only what their role allows.",
    run: async (page) => {
      await page.goto(`${BASE}/login`);
      await page.locator("#password").fill(process.env.APP_PASSWORD || "help-demo");
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL((url) => !url.pathname.startsWith("/login"));
    },
  },
  {
    title: "Progress At A Glance",
    line: "The board shows who is training, who is overdue, and who is stalled, without opening a spreadsheet.",
    run: async (page) => {
      await page.goto(`${BASE}/`);
    },
  },
  {
    title: "Crew Training Paths",
    line: "Foundation plus Service or Production. Each module can open the training material.",
    run: async (page) => {
      await page.goto(`${BASE}/path`);
    },
  },
  {
    title: "Sign-Off",
    line: "Open a trainee, check the module, and the completed date is saved on that person's schedule.",
    run: async (page) => {
      await page.goto(`${BASE}/trainees`);
      const expand = page.getByRole("button", { name: "Expand all" });
      if (await expand.count()) await expand.first().click();
      await page.getByRole("link", { name: /Alex Rivera/ }).first().click();
    },
  },
  {
    title: "The Schedule",
    line: "The calendar counts people, not sessions. Pick a day and see who is training.",
    run: async (page) => {
      await page.goto(`${BASE}/schedule`);
    },
  },
  {
    title: "Every Restaurant",
    line: "A supervisor compares restaurants, selects the stores they need, and reads one report.",
    run: async (page) => {
      await page.goto(`${BASE}/reports`);
    },
  },
  {
    title: "The Daily Roster",
    line: "The employee roster can be updated every day. Names are cleaned up, and job titles stay with each person.",
    run: async (page) => {
      await page.goto(`${BASE}/admin/employees`);
    },
  },
  {
    title: "Roles",
    line: "Users sign off. Managers run one restaurant. Supervisors cover several. Admins set up the whole system.",
    run: async (page) => {
      await page.goto(`${BASE}/admin/users`);
    },
  },
  {
    title: "Help For Every Role",
    line: "Each role has a short help video, so a new manager can learn the desk without a call.",
    run: async (page) => {
      await page.goto(`${BASE}/help`);
    },
  },
  {
    title: "Ready When You Are",
    line: "Training stays in one system, for every restaurant, and it is ready to show a new group.",
  },
];

async function card(page: Page, title: string, line: string) {
  await page.setContent(`<!doctype html><html><body style="margin:0;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#2a2118;color:#fff7e8;font-family:Georgia,serif;text-align:center;padding:48px">
    <p style="letter-spacing:.18em;text-transform:uppercase;font:600 14px ui-sans-serif,sans-serif;color:#e7b008">${title}</p>
    <h1 style="font-size:54px;line-height:1.15;max-width:900px;margin:16px 0 0">${line}</h1>
  </body></html>`);
  await page.waitForTimeout(STEP_MS);
}

async function caption(page: Page, text: string) {
  await page.evaluate((line) => {
    let bar = document.getElementById("help-caption");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "help-caption";
      bar.setAttribute(
        "style",
        "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:rgba(20,16,12,.9);color:#fff;font:600 26px/1.35 ui-sans-serif,sans-serif;padding:18px 32px;text-align:center",
      );
      document.body.appendChild(bar);
    }
    bar.textContent = line;
  }, text);
  await page.waitForTimeout(STEP_MS);
}

function stamp(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}.${String(ms % 1000).padStart(3, "0")}`;
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
  });
}

async function narrate(dir: string) {
  const parts: string[] = [];
  for (let index = 0; index < SCENES.length; index += 1) {
    const wav = path.join(dir, `line-${index}.wav`);
    const padded = path.join(dir, `pad-${index}.wav`);
    await run("espeak-ng", ["-s", "145", "-v", "en-us", "-w", wav, SCENES[index].line]);
    await run("ffmpeg", ["-y", "-i", wav, "-af", `apad=pad_dur=${STEP_MS / 1000}`, "-t", String(STEP_MS / 1000), padded]);
    parts.push(`file '${padded}'`);
  }
  const list = path.join(dir, "list.txt");
  await writeFile(list, parts.join("\n"));
  const voice = path.join(dir, "voice.wav");
  await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", voice]);
  return voice;
}

async function main() {
  await mkdir(RAW, { recursive: true });
  await mkdir(path.dirname(ARTIFACT), { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: RAW, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  for (const scene of SCENES) {
    if (scene.run) {
      await scene.run(page);
      await caption(page, scene.line);
    } else {
      await card(page, scene.title, scene.line);
    }
  }
  const video = page.video();
  await context.close();
  await browser.close();
  const rawPath = video ? await video.path() : "";
  const voice = await narrate(RAW);
  const seconds = (SCENES.length * STEP_MS) / 1000;
  await run("ffmpeg", [
    "-y",
    "-i",
    rawPath,
    "-i",
    voice,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=196:duration=${seconds}`,
    "-filter_complex",
    "[2:a]volume=0.03[bed];[1:a][bed]amix=inputs=2:duration=first:dropout_transition=0[a]",
    "-map",
    "0:v:0",
    "-map",
    "[a]",
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
    "96k",
    "-shortest",
    "-movflags",
    "+faststart",
    ARTIFACT,
  ]);
  const vtt = ["WEBVTT", ""];
  SCENES.forEach((scene, index) => {
    vtt.push(`${stamp(index * STEP_MS)} --> ${stamp((index + 1) * STEP_MS)}`, scene.line, "");
  });
  await writeFile("/opt/cursor/artifacts/ITS_Overview.vtt", vtt.join("\n"));
  console.log("Wrote", ARTIFACT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
