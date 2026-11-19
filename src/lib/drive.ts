export type DriveFile = {
  kind: "file";
  id: string;
  href: string;
  embed: string;
};

export type DriveFolder = {
  kind: "folder";
  id: string;
  href: string;
};

export type ParsedLinks = {
  files: DriveFile[];
  folders: DriveFolder[];
  other: string[];
};

const FILE_ID = /^[a-zA-Z0-9_-]+$/;

function asUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function isDriveHost(url: URL): boolean {
  return url.hostname === "drive.google.com" || url.hostname === "docs.google.com";
}

function folderId(url: URL): string | null {
  const match = url.pathname.match(/\/folders\/([^/]+)/);
  if (match && FILE_ID.test(match[1])) return match[1];
  if (url.pathname.includes("folderview")) {
    const id = url.searchParams.get("id");
    if (id && FILE_ID.test(id)) return id;
  }
  return null;
}

function fileId(url: URL): string | null {
  const match = url.pathname.match(/\/file\/d\/([^/]+)/);
  if (match && FILE_ID.test(match[1])) return match[1];
  const id = url.searchParams.get("id");
  if (!id || !FILE_ID.test(id)) return null;
  if (url.pathname.includes("/open") || url.pathname.includes("/uc") || url.pathname.endsWith("/file")) return id;
  return null;
}

export function parseModuleLinks(raw: string): ParsedLinks {
  const files: DriveFile[] = [];
  const folders: DriveFolder[] = [];
  const other: string[] = [];
  const seen = new Set<string>();
  for (const piece of raw.split(/\s+/)) {
    const value = piece.trim();
    if (!value) continue;
    const url = asUrl(value);
    if (!url) continue;
    if (isDriveHost(url)) {
      const folder = folderId(url);
      if (folder && !seen.has(`folder:${folder}`)) {
        seen.add(`folder:${folder}`);
        folders.push({
          kind: "folder",
          id: folder,
          href: `https://drive.google.com/drive/folders/${folder}`,
        });
        continue;
      }
      const file = fileId(url);
      if (file && !seen.has(`file:${file}`)) {
        seen.add(`file:${file}`);
        files.push({
          kind: "file",
          id: file,
          href: `https://drive.google.com/file/d/${file}/view`,
          embed: `https://drive.google.com/file/d/${file}/preview`,
        });
        continue;
      }
    }
    if (!seen.has(url.href)) {
      seen.add(url.href);
      other.push(url.href);
    }
  }
  return { files, folders, other };
}
