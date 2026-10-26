"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs, Card, CardIcon, TopBar } from "./Chrome";
import { findNode, listFolders, updateNode } from "@/lib/nodes";
import {
  childrenAt,
  countLinks,
  hostOf,
  insertNode,
  isSafeUrl,
  newFolder,
  newLink,
  nodeAt,
  pathOfSlugs,
  removeNode,
  slugify,
  uniqueSlug,
  type Portfolio,
  type TreeNode,
} from "@/lib/tree";

interface Draft {
  id: string | null;
  kind: "link" | "folder";
  title: string;
  url: string;
  icon: string;
  note: string;
  tags: string;
  parent: string[];
}

const pathFromUrl = (url: string): string[] =>
  url.startsWith("/f/") ? url.slice(3).split("/").filter(Boolean) : [];

const emptyDraft = (parent: string[]): Draft => ({
  id: null,
  kind: "link",
  title: "",
  url: "",
  icon: "",
  note: "",
  tags: "",
  parent,
});

const ICON_CODEPOINTS = [
  0x1F4C1, 0x1F4C2, 0x1F4E6, 0x1F5C3, 0x1F310, 0x1F9ED, 0x1F4BB, 0x2328,
  0x1F680, 0x26A1, 0x1F527, 0x2699, 0x1F916, 0x1F4CA, 0x1F4C8, 0x1F50D,
  0x1F3A8, 0x1F3A7, 0x1F3AE, 0x1F4F7, 0x1F3AC, 0x1F4DA, 0x1F4DD, 0x1F4A1,
  0x2615, 0x1F354, 0x2708, 0x1F3E0, 0x2764, 0x2B50, 0x1F525, 0x1F9EA,
];

const ICON_PALETTE = ICON_CODEPOINTS.map((cp) => String.fromCodePoint(cp));

export function BoardApp({
  initial,
  admin,
  storage,
  initialPath,
}: {
  initial: Portfolio;
  admin: boolean;
  storage: "blob" | "file";
  initialPath: string[];
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [tree, setTree] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [path, setPath] = useState(initialPath);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(tree) !== JSON.stringify(baseline),
    [tree, baseline],
  );

  const treeRef = useRef(tree);
  const baselineRef = useRef(baseline);
  treeRef.current = tree;
  baselineRef.current = baseline;

  // Apres un refresh serveur : on ne recouvre l'etat local que s'il n'y a rien de pending.
  useEffect(() => {
    const clean = JSON.stringify(treeRef.current) === JSON.stringify(baselineRef.current);
    if (clean && JSON.stringify(initial) !== JSON.stringify(treeRef.current)) {
      setTree(initial);
      setBaseline(initial);
    }
  }, [initial]);

  const go = useCallback((next: string[]) => {
    setPath(next);
    setQuery("");
    window.history.pushState({}, "", next.length ? `/f/${next.join("/")}` : "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onPop = () => setPath(pathFromUrl(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    document.title = tree.siteTitle?.trim() || "cases";
  }, [tree.siteTitle]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test(
        (event.target as HTMLElement | null)?.tagName ?? "",
      );
      if (event.key === "Escape") {
        setDraft(null);
        setSettings(false);
        setError(null);
        return;
      }
      if (typing) return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key.toLowerCase() === "n" && admin) {
        event.preventDefault();
        setDraft(emptyDraft(path));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [admin, path]);

  const list = useMemo(() => {
    let current = tree.root;
    for (const slug of path) {
      const found = current.find((n) => n.slug === slug && n.kind === "folder");
      current = found?.children ?? [];
    }
    return current;
  }, [tree, path]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const out: { node: TreeNode; path: string[] }[] = [];
    const walk = (nodes: TreeNode[], trail: string[]) => {
      for (const node of nodes) {
        const haystack = [node.title, node.note ?? "", (node.tags ?? []).join(" "), hostOf(node.url)]
          .join(" ")
          .toLowerCase();
        if (haystack.includes(q)) out.push({ node, path: trail });
        if (node.kind === "folder") walk(node.children ?? [], [...trail, node.slug]);
      }
    };
    walk(tree.root, []);
    return out.slice(0, 60);
  }, [tree, query]);

  const folders = useMemo(() => [{ path: [] as string[], label: "tableau" }, ...listFolders(tree.root)], [tree]);
  const total = useMemo(() => tree.root.reduce((sum, n) => sum + countLinks(n), 0), [tree]);

  function interceptClick(event: React.MouseEvent<HTMLElement>) {
    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    if (!anchor) return;
    const href = anchor.getAttribute("href") ?? "";
    if (href !== "/" && !href.startsWith("/f/")) return;
    if (anchor.target === "_blank") return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    go(pathFromUrl(href));
  }

  function commitDraft(next: Draft) {
    const title = next.title.trim() || (next.kind === "folder" ? "Dossier" : "Sans titre");
    setError(null);
    if (next.id) {
      const nodePath = pathOfSlugs(tree.root, next.id) ?? [];
      const parentPath = nodePath.slice(0, -1);
      const siblings = parentOf(tree, parentPath);
      const slug = uniqueSlug(title, siblings, next.id);
      const patch: Partial<TreeNode> = {
        title,
        slug,
        note: next.note.trim(),
        icon: next.icon.trim(),
        ...(next.kind === "folder" ? {} : { url: next.url.trim(), tags: splitTags(next.tags) }),
      };
      let root = updateNode(tree.root, next.id, patch);
      const moved = findNode(root, next.id);
      if (moved && JSON.stringify(parentPath) !== JSON.stringify(next.parent)) {
        root = insertNode({ ...tree, root }, next.parent, moved).root;
      }
      setTree({ ...tree, root });
    } else {
      const siblings = parentOf(tree, next.parent);
      const base =
        next.kind === "folder" ? newFolder(title, siblings) : newLink(title, siblings);
      const node: TreeNode = {
        ...base,
        icon: next.icon.trim(),
        note: next.note.trim(),
        ...(next.kind === "folder" ? {} : { url: next.url.trim(), tags: splitTags(next.tags) }),
      };
      setTree(insertNode(tree, next.parent, node));
    }
    setDraft(null);
    setToast(next.id ? "case mise a jour" : "case creee — pense a enregistrer");
  }

  function remove(id: string) {
    const node = findNode(tree.root, id);
    if (!node) return;
    const label = node.kind === "folder" ? `« ${node.title} » et son contenu` : `« ${node.title} »`;
    if (!window.confirm(`Retirer ${label} du tableau ?`)) return;
    setTree(removeNode(tree, id));
    setDraft(null);
    setToast("case retiree — pense a enregistrer");
  }

  function create(kind: "link" | "folder") {
    setDraft({ ...emptyDraft(path), kind });
  }

  async function persist() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/tree", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tree),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      setBaseline(tree);
      setToast("enregistre");
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  const editing = draft?.id ? findNode(tree.root, draft.id) : null;

  const draftNodePath = draft?.id ? (pathOfSlugs(tree.root, draft.id) ?? []) : [];
  const parentOptions = folders.filter((folder) => {
    if (draftNodePath.length === 0) return true;
    const insideItself =
      folder.path.length >= draftNodePath.length &&
      draftNodePath.every((slug, i) => folder.path[i] === slug);
    return !insideItself;
  });

  return (
    <div className="app" onClick={interceptClick}>
      <TopBar>
        <div className="search">
          <span className="icon" aria-hidden="true">
            ⌕
          </span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder="rechercher une case"
            aria-label="rechercher une case"
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="kbd" aria-hidden="true">
            /
          </span>
        </div>
        <div className="topbar-right">
          <span className="count">
            {total} {total === 1 ? "lien" : "liens"} · {storage}
          </span>
          {admin ? (
            <>
              <button className="btn primary" onClick={() => create("link")}>
                + Nouvelle case
              </button>
              <button className="btn" onClick={() => create("folder")}>
                + Dossier
              </button>
              <button className="btn ghost" onClick={() => setSettings(true)}>
                réglages
              </button>
              <button className="btn ghost" onClick={signOut}>
                quitter
              </button>
            </>
          ) : (
            <a className="btn ghost" href="/admin">
              admin
            </a>
          )}
        </div>
      </TopBar>

      <main className="shell">
        <section className="head">
          <Breadcrumbs path={path} />
          <h1>{path.length === 0 ? tree.siteTitle : (nodeAt(tree, path)?.title ?? path[path.length - 1])}</h1>
          <p>
            {path.length === 0
              ? tree.siteTagline
              : `${list.length} ${list.length === 1 ? "case" : "cases"} a ce niveau`}
          </p>
        </section>

        {results ? (
          <div className="grid">
            {results.length === 0 ? (
              <p className="no-result">Aucune case ne correspond à « {query} ».</p>
            ) : (
              results.map(({ node, path: nodePath }, i) => (
                <Card
                  key={node.id}
                  node={node}
                  path={nodePath}
                  index={i}
                  query={query}
                  admin={admin}
                  pathLabel={nodePath.length ? nodePath.join(" / ") : null}
                  onEdit={(id) => openEditor(id)}
                />
              ))
            )}
          </div>
        ) : (
          <div className="grid">
            {list.map((node, i) => (
              <Card
                key={node.id}
                node={node}
                path={path}
                index={i}
                admin={admin}
                onEdit={(id) => openEditor(id)}
              />
            ))}
            {list.length === 0 ? (
              <div className="empty">
                <h2>Aucune case ici</h2>
                <p>
                  {admin
                    ? "Crée une case pour publier un lien, ou un dossier pour regrouper plusieurs cases."
                    : "Le tableau est vide. Il ne se remplira que par la personne qui le tient."}
                </p>
                {admin ? (
                  <div className="row" style={{ justifyContent: "center" }}>
                    <button className="btn primary" onClick={() => create("link")}>
                      + Nouvelle case
                    </button>
                    <button className="btn" onClick={() => create("folder")}>
                      + Dossier
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <footer className="foot">
          <span>{admin ? "mode admin — lecture publique identique" : "lecture seule"}</span>
          <span>github · vercel</span>
        </footer>
      </main>

      {dirty ? (
        <div className="savebar" role="status">
          <span className="dot" aria-hidden="true" />
          <span>{error ? <span className="err">{error}</span> : "modifications non enregistrees"}</span>
          <button className="btn sm" onClick={() => setTree(initial)} disabled={saving}>
            annuler
          </button>
          <button className="btn primary sm" onClick={persist} disabled={saving}>
            {saving ? "enregistrement..." : "enregistrer"}
          </button>
        </div>
      ) : toast ? (
        <div className="savebar" role="status">
          <span className="dot" aria-hidden="true" />
          <span>{toast}</span>
        </div>
      ) : null}

      {draft ? (
        <EditorModal
          draft={draft}
          folders={parentOptions}
          editing={editing}
          onChange={setDraft}
          onSubmit={commitDraft}
          onClose={() => {
            setDraft(null);
            setError(null);
          }}
          onDelete={() => remove(draft.id as string)}
        />
      ) : null}

      {settings ? (
        <SettingsModal
          title={tree.siteTitle}
          tagline={tree.siteTagline}
          onClose={() => setSettings(false)}
          onSubmit={(siteTitle, siteTagline) => {
            setTree({ ...tree, siteTitle, siteTagline });
            setSettings(false);
            setToast("titre mis a jour — pense a enregistrer");
          }}
        />
      ) : null}
    </div>
  );

  function openEditor(id: string) {
    const node = findNode(tree.root, id);
    if (!node) return;
    const nodePath = pathOfSlugs(tree.root, id) ?? [];
    setDraft({
      id,
      kind: node.kind,
      title: node.title,
      url: node.url ?? "",
      icon: node.icon ?? "",
      note: node.note ?? "",
      tags: (node.tags ?? []).join(", "),
      parent: nodePath.slice(0, -1),
    });
  }
}

function parentOf(tree: Portfolio, parentPath: string[]): TreeNode[] {
  return childrenAt(tree, parentPath) ?? [];
}

function SettingsModal({
  title,
  tagline,
  onClose,
  onSubmit,
}: {
  title: string;
  tagline: string;
  onClose: () => void;
  onSubmit: (title: string, tagline: string) => void;
}) {
  const [nextTitle, setNextTitle] = useState(title);
  const [nextTagline, setNextTagline] = useState(tagline);

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(nextTitle.trim() || "cases", nextTagline.trim());
        }}
      >
        <div className="modal-head">
          <h2>Réglages du tableau</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="fermer">
            ✕
          </button>
        </div>
        <div className="form">
          <div className="field">
            <label htmlFor="s-title">titre de la page</label>
            <input
              id="s-title"
              autoFocus
              value={nextTitle}
              onChange={(event) => setNextTitle(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="s-tagline">accroche sous le titre</label>
            <input
              id="s-tagline"
              value={nextTagline}
              placeholder="une ligne qui explique le tableau"
              onChange={(event) => setNextTagline(event.target.value)}
            />
          </div>
          <p className="hint">
            Le titre s'affiche a la racine et dans l'onglet du navigateur.
          </p>
        </div>
        <div className="modal-foot">
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            annuler
          </button>
          <button type="submit" className="btn primary">
            appliquer
          </button>
        </div>
      </form>
    </div>
  );
}

function IconPreview({ draft }: { draft: Draft }) {
  const node: TreeNode = {
    id: "preview",
    kind: draft.kind,
    slug: slugify(draft.title) || "case",
    title: draft.title || (draft.kind === "folder" ? "Dossier" : "Sans titre"),
    url: draft.url.trim(),
    icon: draft.icon.trim(),
    createdAt: 0,
  };
  return <CardIcon node={node} />;
}

function splitTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean),
    ),
  ).slice(0, 6);
}

function EditorModal({
  draft,
  folders,
  editing,
  onChange,
  onSubmit,
  onClose,
  onDelete,
}: {
  draft: Draft;
  folders: { path: string[]; label: string }[];
  editing: TreeNode | null;
  onChange: (draft: Draft) => void;
  onSubmit: (draft: Draft) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const badUrl = Boolean(draft.url.trim()) && !isSafeUrl(draft.url.trim());
  const slugPreview = draft.title.trim() || (draft.kind === "folder" ? "dossier" : "case");

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!badUrl) onSubmit(draft);
        }}
      >
        <div className="modal-head">
          <h2>{draft.id ? "Modifier la case" : "Nouvelle case"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="fermer">
            ✕
          </button>
        </div>

        <div className="form">
          {!draft.id ? (
            <div className="field">
              <label>type</label>
              <div className="row" style={{ gap: "0.4rem" }}>
                {(["link", "folder"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={`btn ${draft.kind === kind ? "primary" : ""}`}
                    onClick={() => onChange({ ...draft, kind })}
                  >
                    {kind === "link" ? "lien vers un site" : "dossier de cases"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="f-title">titre</label>
            <input
              id="f-title"
              autoFocus
              value={draft.title}
              placeholder={draft.kind === "folder" ? "Projets" : "Mon site"}
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="f-icon">icone</label>
            <div className="icon-input">
              <span className="icon-preview" aria-hidden="true">
                <IconPreview draft={draft} />
              </span>
              <input
                id="f-icon"
                value={draft.icon}
                placeholder="un emoji, ou l'adresse d'une image"
                onChange={(event) => onChange({ ...draft, icon: event.target.value })}
              />
              {draft.icon ? (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onChange({ ...draft, icon: "" })}
                  aria-label="retirer l'icone"
                >
                  ✕
                </button>
              ) : null}
            </div>
            <div className="palette">
              {ICON_PALETTE.map((glyph) => (
                <button
                  key={glyph}
                  type="button"
                  className={`palette-btn${draft.icon === glyph ? " on" : ""}`}
                  onClick={() => onChange({ ...draft, icon: glyph })}
                  aria-label={`icone ${glyph}`}
                >
                  {glyph}
                </button>
              ))}
            </div>
          </div>

          {draft.kind !== "folder" ? (
            <div className="field">
              <label htmlFor="f-url">adresse du site</label>
              <input
                id="f-url"
                value={draft.url}
                placeholder="https://..."
                onChange={(event) => onChange({ ...draft, url: event.target.value })}
              />
              {badUrl ? <span className="err">http, https ou mailto uniquement</span> : null}
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="f-note">
              {draft.kind === "folder" ? "description du dossier" : "note"}
            </label>
            <textarea
              id="f-note"
              value={draft.note}
              placeholder="une phrase suffit"
              onChange={(event) => onChange({ ...draft, note: event.target.value })}
            />
          </div>

          <div className="row">
            {draft.kind !== "folder" ? (
              <div className="field">
                <label htmlFor="f-tags">etiquettes</label>
                <input
                  id="f-tags"
                  value={draft.tags}
                  placeholder="web, rust, perso"
                  onChange={(event) => onChange({ ...draft, tags: event.target.value })}
                />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="f-parent">emplacement</label>
              <select
                id="f-parent"
                value={draft.parent.join("/")}
                onChange={(event) => {
                  const found = folders.find((f) => f.path.join("/") === event.target.value);
                  onChange({ ...draft, parent: found ? found.path : [] });
                }}
              >
                {folders.map((folder) => (
                  <option key={folder.label} value={folder.path.join("/")}>
                    {folder.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="hint">
            adresse publique&nbsp;:{" "}
            <b>
              {draft.kind === "folder"
                ? `/f/${[...draft.parent, uidSafeSlug(slugPreview)].join("/")}`
                : draft.url.trim() || "—"}
            </b>
          </p>
        </div>

        <div className="modal-foot">
          {editing ? (
            <button type="button" className="btn danger" onClick={onDelete}>
              retirer
            </button>
          ) : null}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            annuler
          </button>
          <button type="submit" className="btn primary" disabled={badUrl}>
            {draft.id ? "appliquer" : "ajouter"}
          </button>
        </div>
      </form>
    </div>
  );
}

function uidSafeSlug(title: string): string {
  return slugify(title);
}
