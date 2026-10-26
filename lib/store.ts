import { promises as fs } from "node:fs";
import path from "node:path";
import { emptyPortfolio, normalize, type Portfolio } from "./tree";

const BLOB_KEY = "portfolio/data.json";
const LOCAL_FILE = path.join(process.cwd(), "data", "portfolio.json");

/**
 * Blob des que Vercel fournit de quoi l'authentifier : jeton statique (ancienne
 * methode) ou connexion de store en mode OIDC (BLOB_STORE_ID + VERCEL_OIDC_TOKEN).
 */
export function storageMode(): "blob" | "file" {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN) return "blob";
  return process.env.VERCEL === "1" ? "blob" : "file";
}

/**
 * Lecture via l'API authentifiee (`get`), pas via l'URL publique : le CDN de Blob
 * cle sur le chemin et ignore tout parametre de query, donc l'URL peut servir une
 * copie de quelques secondes apres une ecriture. `get` renvoie null si le fichier
 * n'existe pas ; toute autre erreur remonte, pour ne jamais afficher un tableau
 * vide qui serait ensuite enregistre par-dessus les donnees reelles.
 */
async function readBlob(): Promise<Portfolio | null> {
  const { get } = await import("@vercel/blob");
  const result = await get(BLOB_KEY, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    headers: { "cache-control": "no-cache" },
  });
  if (result === null) return null;
  if (!result.stream) throw new Error("Blob: reponse sans contenu");
  const text = await new Response(result.stream).text();
  return normalize(JSON.parse(text));
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
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT") return null;
    throw error;
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
