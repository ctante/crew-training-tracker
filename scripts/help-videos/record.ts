import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { HELP_GUIDES } from "../../src/lib/help";
import { holdSeconds, publishNarration, synthesize } from "./voice";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RAW = path.join(ROOT, "tmp/help-raw");
const OUT = path.join(ROOT, "content/help");
const BASE = process.env.HELP_BASE_URL ?? "http://127.0.0.1:3010";

const ACTIONS: Record<string, ((page: Page) => Promise<void>)[]> = {
  USER: [
    async (page) => {
      await signIn(page, "north.user", "help-demo");
    },
    async (page) => {
      await page.goto(`${BASE}/`);
      await expand(page);
    },
    async (page) => {
      await page.getByRole("link", { name: /Alex Rivera/ }).first().click();
      await page.waitForURL(/\/trainees\//);
    },
    async (page) => {
      const box = page.locator("input[type=checkbox]").first();
      if (await box.count()) await box.check();
    },
    async (page) => {
      const signOut = page.getByRole("button", { name: "Sign out" });
      const count = await signOut.count();
      for (let index = 0; index < count; index += 1) {
        if (await signOut.nth(index).isVisible()) {
          await signOut.nth(index).evaluate((button) => button.closest("form")?.requestSubmit());
          break;
        }
      }
      await page.waitForURL(/\/login/, { waitUntil: "commit" });
    },
  ],
  MANAGER: [
    async (page) => {
      await signIn(page, "north.manager", "help-demo");
    },
    async (page) => {
      await page.goto(`${BASE}/trainees`);
      await expand(page);
    },
    async (page) => {
      await page.goto(`${BASE}/trainees/new`);
      await page.locator("input[name=name]").fill("Avery Brooks");
      const position = page.locator("select[name=position]");
      if (await position.count()) await position.selectOption({ index: 1 }).catch(() => undefined);
      await page.locator("select[name=path]").selectOption("SERVICE");
      await page.getByRole("button", { name: "Create schedule" }).click();
      await page.waitForURL(/\/trainees\//, { timeout: 15000 }).catch(() => undefined);
    },
    async (page) => {
      const box = page.locator("input[type=checkbox]").first();
      if (await box.count()) await box.check();
    },
    async (page) => {
      await page.goto(`${BASE}/schedule`);
      const day = page.locator("div.mt-1.grid a", { hasText: "24" }).first();
      if (await day.count()) await day.click();
    },
    async () => undefined,
  ],
  SUPERVISOR: [
    async (page) => {
      await signIn(page, "area.supervisor", "help-demo");
    },
    async (page) => {
      await page.goto(`${BASE}/reports`);
      const clear = page.getByRole("button", { name: /Clear All/ });
      if (await clear.count()) await clear.click();
      const select = page.getByRole("button", { name: /Select All/ });
      if (await select.count()) await select.click();
      const apply = page.getByRole("button", { name: /Apply stores/ });
      if (await apply.count()) await apply.click();
      await page.waitForLoadState("networkidle").catch(() => undefined);
    },
    async (page) => {
      await page.evaluate(() => window.scrollTo(0, 480));
    },
    async (page) => {
      await page.goto(`${BASE}/schedule`);
    },
    async (page) => {
      await page.goto(`${BASE}/`);
      await expand(page);
      const link = page.getByRole("link", { name: /Alex Rivera/ }).first();
      if (await link.count()) await link.click();
    },
  ],
  ADMIN: [
    async (page) => {
      await signIn(page, "", process.env.APP_PASSWORD || "help-demo");
    },
    async (page) => {
      await page.goto(`${BASE}/admin/employees`);
    },
    async (page) => {
      const summary = page.locator("summary", { hasText: "Import CSV" });
      if (await summary.count()) await summary.click();
    },
    async (page) => {
      await page.goto(`${BASE}/admin/users`);
    },
    async (page) => {
      await page.goto(`${BASE}/admin/access`);
    },
    async (page) => {
      await page.goto(`${BASE}/admin/modules`);
    },
  ],
};

async function expand(page: Page) {
  const button = page.getByRole("button", { name: "Expand all" });
  if (await button.count()) {
    await button.first().click();
    return;
  }
  const closed = page.locator("section button[aria-expanded='false']");
  const count = await closed.count();
  for (let index = 0; index < count; index += 1) await closed.nth(index).click();
}

async function signIn(page: Page, login: string, password: string) {
  await page.goto(`${BASE}/login`);
  if (login) await page.locator("#login").fill(login);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function settle(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((node) => node.remove());
    document.getElementById("help-caption")?.remove();
  });
}

async function main() {
  for (const guide of HELP_GUIDES) {
    if (ACTIONS[guide.id]?.length !== guide.steps.length) {
      throw new Error(`${guide.id} has ${guide.steps.length} steps and ${ACTIONS[guide.id]?.length ?? 0} actions`);
    }
  }
  await mkdir(OUT, { recursive: true });
  await mkdir(RAW, { recursive: true });
  const speechDir = path.join(RAW, "speech");
  const durations = await synthesize(
    speechDir,
    HELP_GUIDES.map((guide) => ({ id: guide.id, lines: guide.steps })),
  );
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  for (const guide of HELP_GUIDES) {
    const slug = guide.id.toLowerCase();
    const steps = guide.steps;
    const lengths = durations[guide.id];
    const wallStart = Date.now();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: path.join(RAW, slug), size: { width: 1280, height: 720 } },
    });
    await context.addInitScript(() => {
      const hide = () => document.querySelectorAll("nextjs-portal").forEach((node) => node.remove());
      new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
      hide();
    });
    const page = await context.newPage();
    const cues: { line: string; at: number; file: string }[] = [];
    for (let index = 0; index < steps.length; index += 1) {
      await ACTIONS[guide.id][index](page);
      await settle(page);
      cues.push({
        line: steps[index],
        at: (Date.now() - wallStart) / 1000,
        file: path.join(speechDir, `${guide.id}-${index}.wav`),
      });
      const hold = holdSeconds(lengths[index] ?? 4) * 1000;
      await page.waitForTimeout(hold);
    }
    await page.waitForTimeout(400);
    const video = page.video();
    await context.close();
    const wallEnd = Date.now();
    const rawPath = video ? await video.path() : "";
    await publishNarration({
      rawPath,
      wallStart,
      wallEnd,
      cues,
      out: path.join(OUT, `${slug}.mp4`),
      posterPath: path.join(OUT, `${slug}.jpg`),
      vttPath: path.join(OUT, `${slug}.vtt`),
      workDir: path.join(RAW, slug),
    });
    console.log("Wrote", path.join(OUT, `${slug}.mp4`));
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
