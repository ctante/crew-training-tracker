import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium, type Page } from "playwright";
import { HELP_GUIDES } from "../../src/lib/help";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RAW = path.join(ROOT, "tmp/help-raw");
const OUT = path.join(ROOT, "public/help");
const BASE = process.env.HELP_BASE_URL ?? "http://127.0.0.1:3010";
const STEP_MS = 11000;

const SCRIPTS: Record<string, (page: Page, say: (text: string) => Promise<void>) => Promise<void>> = {
  USER: async (page, say) => {
    await signIn(page, "north.user", "help-demo");
    await say("Sign in with your username and password.");
    await page.goto(`${BASE}/`);
    await say("Open the Board. It lists the trainees at your restaurant.");
    await expand(page);
    await page.getByRole("link", { name: /Alex Rivera/ }).first().click();
    await say("Open a trainee to see the Individual Training Schedule.");
    const box = page.locator("input[type=checkbox]").first();
    if (await box.count()) await box.check();
    await say("Check Completed on a module that is finished. The date fills in.");
    await say("Sign out when you leave the shared desk.");
  },
  MANAGER: async (page, say) => {
    await signIn(page, "north.manager", "help-demo");
    await say("Sign in as a Manager for your restaurant.");
    await page.goto(`${BASE}/trainees`);
    await say("Open Trainees to see that restaurant's crew.");
    await page.goto(`${BASE}/trainees/new`);
    await page.locator("input[name=name]").fill("Taylor Brooks");
    const position = page.locator("select[name=position]");
    if (await position.count()) await position.selectOption({ index: 1 }).catch(() => undefined);
    await page.locator("select[name=path]").selectOption("SERVICE");
    await say("Add a trainee and choose Service or Production. Foundation is included.");
    await page.getByRole("button", { name: "Create schedule" }).click();
    await page.waitForURL(/\/trainees\//, { timeout: 15000 }).catch(() => undefined);
    await say("Open the new schedule. Check Completed when a module is finished.");
    await page.goto(`${BASE}/schedule`);
    await say("Open Schedule and pick a day. The number is how many people train that day.");
    await say("The full Employee Roster is an Admin page. A Manager uses Trainees and Schedule.");
  },
  SUPERVISOR: async (page, say) => {
    await signIn(page, "area.supervisor", "help-demo");
    await say("Sign in as a Supervisor. You can see every restaurant assigned to you.");
    await page.goto(`${BASE}/reports`);
    await say("Open Reports. Use Select All or Clear All, then Apply Stores.");
    const clear = page.getByRole("button", { name: /Clear All/ });
    if (await clear.count()) await clear.click();
    const select = page.getByRole("button", { name: /Select All/ });
    if (await select.count()) await select.click();
    await say("Read completion by restaurant to compare progress.");
    await page.goto(`${BASE}/schedule`);
    await say("Open Schedule and switch the restaurant to see one store or all of yours.");
    await say("Open a trainee when you need to sign off or check a date.");
  },
  ADMIN: async (page, say) => {
    await signIn(page, "", process.env.APP_PASSWORD || "help-demo");
    await say("Sign in with the admin password. Leave the username blank.");
    await page.goto(`${BASE}/admin/employees`);
    await say("Open Admin, then Employee Roster. Positions come from the roster import.");
    await page.goto(`${BASE}/admin/users`);
    await say("Open Users to add an account and choose a role.");
    await page.goto(`${BASE}/admin/access`);
    await say("Open Store Passwords to set the shared login for a restaurant.");
    await page.goto(`${BASE}/admin/modules`);
    await say("Open Modules to review the Crew Training Path materials.");
  },
};

async function expand(page: Page) {
  const button = page.getByRole("button", { name: "Expand all" });
  if (await button.count()) await button.first().click();
}

async function signIn(page: Page, login: string, password: string) {
  await page.goto(`${BASE}/login`);
  if (login) await page.locator("#login").fill(login);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function caption(page: Page, text: string) {
  await page.evaluate((line) => {
    let bar = document.getElementById("help-caption");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "help-caption";
      bar.setAttribute("style", "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:rgba(20,16,12,.9);color:#fff;font:600 24px/1.35 ui-sans-serif,sans-serif;padding:18px 28px;text-align:center");
      document.body.appendChild(bar);
    }
    bar.textContent = line;
  }, text);
  await page.waitForTimeout(STEP_MS);
}

function vtt(steps: string[]) {
  const lines = ["WEBVTT", ""];
  steps.forEach((step, index) => {
    const start = index * STEP_MS;
    const end = start + STEP_MS;
    lines.push(`${stamp(start)} --> ${stamp(end)}`, step, "");
  });
  return lines.join("\n");
}

function stamp(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  const milli = String(ms % 1000).padStart(3, "0");
  return `${h}:${m}:${s}.${milli}`;
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
  });
}

async function main() {
  await mkdir(RAW, { recursive: true });
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  for (const guide of HELP_GUIDES) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: RAW, size: { width: 1280, height: 720 } },
    });
    const page = await context.newPage();
    await SCRIPTS[guide.id](page, (text) => caption(page, text));
    const video = page.video();
    await context.close();
    const rawPath = video ? await video.path() : "";
    const slug = guide.id.toLowerCase();
    const mp4 = path.join(OUT, `${slug}.mp4`);
    await run("ffmpeg", ["-y", "-i", rawPath, "-r", "12", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "32", "-movflags", "+faststart", "-an", mp4]);
    await run("ffmpeg", ["-y", "-ss", "3", "-i", mp4, "-frames:v", "1", path.join(OUT, `${slug}.jpg`)]);
    await writeFile(path.join(OUT, `${slug}.vtt`), vtt(guide.steps));
    console.log("Wrote", mp4);
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
