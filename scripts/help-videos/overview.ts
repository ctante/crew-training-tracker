import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { holdSeconds, publishNarration, synthesize } from "./voice";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RAW = path.join(ROOT, "tmp/help-raw");
const BASE = process.env.HELP_BASE_URL ?? "http://127.0.0.1:3010";
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

async function card(page: Page, title: string) {
  await page.setContent(`<!doctype html><html><body style="margin:0;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#2a2118;color:#fff7e8;font-family:Georgia,serif;text-align:center;padding:48px">
    <h1 style="font-size:64px;line-height:1.15;max-width:900px;margin:0">${title}</h1>
  </body></html>`);
}

async function settle(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((node) => node.remove());
    document.getElementById("help-caption")?.remove();
  });
}

async function main() {
  await mkdir(RAW, { recursive: true });
  await mkdir(path.dirname(ARTIFACT), { recursive: true });
  const speechDir = path.join(RAW, "overview-speech");
  const durations = await synthesize(speechDir, [{ id: "overview", lines: SCENES.map((scene) => scene.line) }]);
  const lengths = durations.overview;
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const wallStart = Date.now();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: RAW, size: { width: 1280, height: 720 } },
  });
  await context.addInitScript(() => {
    const hide = () => document.querySelectorAll("nextjs-portal").forEach((node) => node.remove());
    new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
    hide();
  });
  const page = await context.newPage();
  const cues: { line: string; at: number; file: string }[] = [];
  for (let index = 0; index < SCENES.length; index += 1) {
    const scene = SCENES[index];
    if (scene.run) {
      await scene.run(page);
      await settle(page);
    } else {
      await card(page, scene.title);
    }
    cues.push({
      line: scene.line,
      at: (Date.now() - wallStart) / 1000,
      file: path.join(speechDir, `overview-${index}.wav`),
    });
    await page.waitForTimeout(holdSeconds(lengths[index] ?? 5) * 1000);
  }
  await page.waitForTimeout(500);
  const video = page.video();
  await context.close();
  const wallEnd = Date.now();
  await browser.close();
  const rawPath = video ? await video.path() : "";
  await publishNarration({
    rawPath,
    wallStart,
    wallEnd,
    cues,
    out: ARTIFACT,
    vttPath: "/opt/cursor/artifacts/ITS_Overview.vtt",
    embedSubtitles: true,
    workDir: RAW,
  });
  console.log("Wrote", ARTIFACT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
