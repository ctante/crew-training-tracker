export type ModuleText = {
  name: string;
  videoTitles: string;
  note: string;
};

export function spanishTextUpdate(input: {
  manual: boolean;
  force: boolean;
  english: ModuleText & { link: string };
  spanish: ModuleText & { link: string };
  previousEnglishLink: string;
  translated: ModuleText | null;
}): { text: ModuleText; link: string; warning?: string; manual: boolean } {
  const ownLink = input.spanish.link.trim() !== "" && input.spanish.link.trim() !== input.previousEnglishLink.trim();
  const link = ownLink ? input.spanish.link : input.english.link;
  if (input.manual && !input.force) {
    return { text: input.spanish, link, manual: true };
  }
  if (!input.translated) {
    return {
      text: {
        name: input.spanish.name.trim() || input.english.name,
        videoTitles: input.spanish.videoTitles.trim() || input.english.videoTitles,
        note: input.spanish.note.trim() || input.english.note,
      },
      link,
      manual: input.manual,
      warning: "Spanish translation did not run. English text was kept.",
    };
  }
  return {
    text: {
      name: input.translated.name.trim() || input.english.name,
      videoTitles: input.translated.videoTitles,
      note: input.translated.note,
    },
    link,
    manual: false,
  };
}

export function spanishNeedsTranslation(english: ModuleText, spanish: ModuleText, manual: boolean): boolean {
  if (manual) return false;
  if (!spanish.name.trim() || spanish.name.trim() === english.name.trim()) return true;
  if (english.videoTitles.trim() && !spanish.videoTitles.trim()) return true;
  if (english.note.trim() && !spanish.note.trim()) return true;
  return false;
}

export async function translateToSpanish(text: ModuleText): Promise<ModuleText | null> {
  if (!text.name.trim() && !text.videoTitles.trim() && !text.note.trim()) {
    return { name: "", videoTitles: "", note: "" };
  }
  const prompt = [
    "Translate these crew-training fields from English to Spanish.",
    "Return only JSON with keys name, videoTitles, and note.",
    "Keep blank fields blank. Keep line breaks inside videoTitles. Do not translate URLs.",
    JSON.stringify(text),
  ].join("\n");
  try {
    const fromGateway = await gatewayTranslation(prompt);
    if (fromGateway) return fromGateway;
  } catch {
    // The gateway needs Vercel OIDC. A local run falls through.
  }
  try {
    return await memoryTranslation(text);
  } catch {
    return null;
  }
}

async function gatewayTranslation(prompt: string): Promise<ModuleText | null> {
  if (!process.env.VERCEL_OIDC_TOKEN && !process.env.AI_GATEWAY_API_KEY) return null;
  const { generateText } = await import("ai");
  const { text } = await generateText({
    model: "google/gemini-2.5-flash-lite",
    prompt,
    timeout: 20000,
  });
  return parseTranslation(text);
}

async function memoryTranslation(text: ModuleText): Promise<ModuleText | null> {
  const name = await memoryLine(text.name);
  const note = await memoryLine(text.note);
  const titles = await Promise.all(text.videoTitles.split("\n").map((line) => memoryLine(line)));
  if (name === null || note === null || titles.some((line) => line === null)) return null;
  return { name, note, videoTitles: titles.join("\n") };
}

async function memoryLine(value: string): Promise<string | null> {
  if (!value.trim()) return "";
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(value.slice(0, 450))}&langpair=en|es`;
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  const body = (await response.json()) as { responseData?: { translatedText?: string } };
  const translated = body.responseData?.translatedText?.trim();
  if (!translated || translated.toUpperCase().includes("MYMEMORY WARNING")) return null;
  return translated;
}

function parseTranslation(raw: string): ModuleText | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    const value = JSON.parse(raw.slice(start, end + 1)) as Partial<ModuleText>;
    if (typeof value.name !== "string" || typeof value.videoTitles !== "string" || typeof value.note !== "string") {
      return null;
    }
    return { name: value.name, videoTitles: value.videoTitles, note: value.note };
  } catch {
    return null;
  }
}
