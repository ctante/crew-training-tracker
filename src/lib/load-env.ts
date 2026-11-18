import { readFileSync } from "node:fs";

export function loadLocalEnv() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL_UNPOOLED) return;
  let text = "";
  try {
    text = readFileSync(".env", "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator);
    if (process.env[key]) continue;
    const raw = trimmed.slice(separator + 1).trim();
    process.env[key] = raw.replace(/^"(.*)"$/, "$1");
  }
}
