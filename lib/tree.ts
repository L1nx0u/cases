export type NodeKind = "link" | "folder";

export interface TreeNode {
  id: string;
  kind: NodeKind;
  slug: string;
  title: string;
  url?: string;
  icon?: string;
  note?: string;
  tags?: string[];
  children?: TreeNode[];
  createdAt: number;
}

export interface Portfolio {
  version: 1;
  siteTitle: string;
  siteTagline: string;
  root: TreeNode[];
}

export const emptyPortfolio = (): Portfolio => ({
  version: 1,
  siteTitle: "cases",
  siteTagline: "un tableau vide. tant que je n'y pose rien.",
  root: [],
});

export function uid(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10);
}

const MODIFIERS: Record<string, string> = {
  à: "a", á: "a", â: "a", ã: "a", ä: "a", å: "a",
  è: "e", é: "e", ê: "e", ë: "e",
  ì: "i", í: "i", î: "i", ï: "i",
  ò: "o", ó: "o", ô: "o", õ: "o", ö: "o",
  ù: "u", ú: "u", û: "u", ü: "u",
  ç: "c", ñ: "n", ÿ: "y",
};

export function slugify(input: string): string {
  const lowered = (input || "").toLowerCase();
  const ascii = Array.from(lowered)
    .map((ch) => MODIFIERS[ch] ?? ch)
    .join("");
  const cleaned = ascii
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return cleaned || "case";
}

export function uniqueSlug(title: string, siblings: TreeNode[], ignoreId?: string): string {
  const base = slugify(title);
  const taken = new Set(siblings.filter((s) => s.id !== ignoreId).map((s) => s.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function newLink(title: string, siblings: TreeNode[]): TreeNode {
  return {
    id: uid(),
    kind: "link",
    slug: uniqueSlug(title, siblings),
    title: title.trim() || "Sans titre",
    url: "",
    note: "",
    tags: [],
    createdAt: Date.now(),
  };
}

export function newFolder(title: string, siblings: TreeNode[]): TreeNode {
  return {
    id: uid(),
    kind: "folder",
    slug: uniqueSlug(title, siblings),
    title: title.trim() || "Dossier",
    children: [],
    createdAt: Date.now(),
  };
}

/** Retourne les enfants d'un dossier repere par sa chaine de slugs, ou null. */
export function childrenAt(portfolio: Portfolio, path: string[]): TreeNode[] | null {
  let list: TreeNode[] = portfolio.root;
  for (const slug of path) {
    const found = list.find((n) => n.slug === slug && n.kind === "folder");
    if (!found) return null;
    list = found.children ?? [];
  }
  return list;
}

export function nodeAt(portfolio: Portfolio, path: string[]): TreeNode | null {
  let list: TreeNode[] = portfolio.root;
  let current: TreeNode | null = null;
  for (const slug of path) {
    const found = list.find((n) => n.slug === slug);
    if (!found) return null;
    current = found;
    if (found.kind !== "folder") return found;
    list = found.children ?? [];
  }
  return current;
}

export function pathOfSlugs(nodes: TreeNode[], id: string, trail: string[] = []): string[] | null {
  for (const node of nodes) {
    if (node.id === id) return [...trail, node.slug];
    if (node.kind === "folder") {
      const hit = pathOfSlugs(node.children ?? [], id, [...trail, node.slug]);
      if (hit) return hit;
    }
  }
  return null;
}

export function countLinks(node: TreeNode): number {
  if (node.kind === "link") return 1;
  return (node.children ?? []).reduce((sum, child) => sum + countLinks(child), 0);
}

export function depth(node: TreeNode): number {
  if (node.kind === "link") return 1;
  const kids = node.children ?? [];
  return kids.length === 0 ? 1 : 1 + Math.max(...kids.map(depth));
}

/** Cloner + appliquer un mutateur sur la liste d'enfants visee par `path`. */
export function transformAt(
  portfolio: Portfolio,
  path: string[],
  mutate: (list: TreeNode[]) => TreeNode[],
): Portfolio {
  const clone: Portfolio = structuredClone(portfolio);
  if (path.length === 0) {
    clone.root = mutate(clone.root);
    return clone;
  }
  let list = clone.root;
  for (let i = 0; i < path.length; i += 1) {
    const slug = path[i];
    const found = list.find((n) => n.slug === slug && n.kind === "folder");
    if (!found) return clone;
    if (i === path.length - 1) {
      found.children = mutate(found.children ?? []);
      return clone;
    }
    list = found.children ?? [];
  }
  return clone;
}

/** Retire un noeud n'importe ou dans l'arbre. */
export function removeNode(portfolio: Portfolio, id: string): Portfolio {
  const clone: Portfolio = structuredClone(portfolio);
  const walk = (list: TreeNode[]): TreeNode[] =>
    list
      .filter((n) => n.id !== id)
      .map((n) => {
        if (n.kind === "folder") n.children = walk(n.children ?? []);
        return n;
      });
  clone.root = walk(clone.root);
  return clone;
}

/** Insere `node` dans la liste de `path` a l'index `index` (deplace si deja present). */
export function insertNode(
  portfolio: Portfolio,
  path: string[],
  node: TreeNode,
  index?: number,
): Portfolio {
  const without = removeNode(portfolio, node.id);
  return transformAt(without, path, (list) => {
    const next = [...list];
    const at = index === undefined || index < 0 || index > next.length ? next.length : index;
    next.splice(at, 0, node);
    return next;
  });
}

/**
 * Signature du contenu. Servie au client a la lecture, renvoyee a l'ecriture :
 * un enregistrement qui ne la retrouve pas dans le store est refuse, ce qui
 * empeche un vieil onglet d'ecrire par-dessus le travail d'une autre session.
 */
export function versionOf(portfolio: Portfolio): string {
  const text = JSON.stringify(portfolio);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(36)}-${h2.toString(36)}`;
}

export function normalize(input: unknown): Portfolio {
  const fallback = emptyPortfolio();
  if (!input || typeof input !== "object") return fallback;
  const raw = input as Partial<Portfolio>;
  const walk = (list: unknown): TreeNode[] => {
    if (!Array.isArray(list)) return [];
    return list
      .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
      .map((n) => {
        const kind = n.kind === "folder" ? "folder" : "link";
        const title = typeof n.title === "string" ? n.title : "Sans titre";
        const node: TreeNode = {
          id: typeof n.id === "string" && n.id ? n.id : uid(),
          kind,
          slug: typeof n.slug === "string" && n.slug ? n.slug : slugify(title),
          title,
          createdAt: typeof n.createdAt === "number" ? n.createdAt : Date.now(),
        };
        node.note = typeof n.note === "string" ? n.note : "";
        node.icon = typeof n.icon === "string" ? n.icon.trim() : "";
        if (kind === "link") {
          node.url = typeof n.url === "string" ? n.url : "";
          node.tags = Array.isArray(n.tags) ? n.tags.filter((t): t is string => typeof t === "string") : [];
        } else {
          node.children = walk(n.children);
        }
        return node;
      });
  };
  return {
    version: 1,
    siteTitle: typeof raw.siteTitle === "string" && raw.siteTitle ? raw.siteTitle : fallback.siteTitle,
    siteTagline: typeof raw.siteTagline === "string" ? raw.siteTagline : fallback.siteTagline,
    root: walk(raw.root),
  };
}

export function isSafeUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

export function hostOf(value?: string): string {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value.slice(0, 40);
  }
}

export function isRepo(value?: string): boolean {
  if (!value) return false;
  return /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/.test(value);
}

export function isImageUrl(value?: string): boolean {
  return Boolean(value && /^https?:\/\//i.test(value));
}

export function monogram(node: TreeNode): string {
  const source = hostOf(node.url) || node.title || "case";
  const letter = source.replace(/^[^a-z0-9]+/i, "").charAt(0);
  return (letter || "?").toUpperCase();
}

export function hueOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 33 + seed.charCodeAt(i)) % 360;
  return h;
}
