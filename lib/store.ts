import { promises as fs } from "node:fs";
import path from "node:path";
import { emptyPortfolio, normalize, type Portfolio } from "./tree";

const BLOB_KEY = "portfolio/data.json";
const LOCAL_FILE = path.join(process.cwd(), "data", "portfolio.json");

export function storageMode(): "blob" | "file" {
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "file";
}

async function readBlob(): Promise<Portfolio | null> {
  const { head } = await import("@vercel/blob");
  try {
    const blob = await head(BLOB_KEY, { token: process.env.BLOB_READ_WRITE_TOKEN });
    const res = await fetch(blob.url, { cache: "no-store" });
    if (!res.ok) return null;
    return normalize(await res.json());
  } catch {
    return null;
  }
}

async function writeBlob(portfolio: Portfolio): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(BLOB_KEY, JSON.stringify(portfolio, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
    contentType: "application/json",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
}

async function readFile(): Promise<Portfolio | null> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf8");
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeFile(portfolio: Portfolio): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(portfolio, null, 2), "utf8");
}

export async function loadPortfolio(): Promise<Portfolio> {
  const stored = storageMode() === "blob" ? await readBlob() : await readFile();
  return stored ?? emptyPortfolio();
}

export async function savePortfolio(portfolio: Portfolio): Promise<void> {
  if (storageMode() === "blob") await writeBlob(portfolio);
  else await writeFile(portfolio);
}

export const localFilePath = LOCAL_FILE;
