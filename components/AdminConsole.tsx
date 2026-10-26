"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Board } from "./Board";
import { findNode, listFolders, updateNode } from "@/lib/nodes";
import {
  insertNode,
  newFolder,
  newLink,
  normalize,
  pathOfSlugs,
  uniqueSlug,
  type Portfolio,
  type TreeNode,
} from "@/lib/tree";

type Tone = "idle" | "ok" | "err" | "dirty";

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function AdminConsole({ initial, storage }: { initial: Portfolio; storage: "blob" | "file" }) {
  const router = useRouter();
  const [tree, setTree] = useState<Portfolio>(initial);
  const [path, setPath] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [tab, setTab] = useState<"cases" | "json">("cases");
  const [raw, setRaw] = useState(() => JSON.stringify(initial, null, 2));
  const [status, setStatus] = useState<{ tone: Tone; msg: string }>({ tone: "idle", msg: "" });

  const dirty = !sameJson(tree, initial);
  const list = useMemo(() => {
    let current = tree.root;
    for (const slug of path) {
      const found = current.find((n) => n.slug === slug && n.kind === "folder");
      current = found?.children ?? [];
    }
    return current;
  }, [tree, path]);

  const editing = editingId ? findNode(tree.root, editingId) : null;
  const editingSiblings = useMemo(() => {
    if (!editing) return [] as TreeNode[];
    const nodePath = pathOfSlugs(tree.root, editing.id) ?? [];
    let current = tree.root;
    for (const slug of nodePath.slice(0, -1)) {
      const found = current.find((n) => n.slug === slug && n.kind === "folder");
      current = found?.children ?? [];
    }
    return current;
  }, [tree, editing]);

  const folders = useMemo(() => [{ path: [] as string[], label: "racine" }, ...listFolders(tree.root)], [tree]);

  function flash(tone: Tone, msg: string) {
    setStatus({ tone, msg });
  }

  function create(kind: "link" | "folder") {
    const title = kind === "link" ? "nouvelle case" : "nouveau dossier";
    const node = kind === "link" ? newLink(title, list) : newFolder(title, list);
    setTree(insertNode(tree, path, node));
    setEditingId(node.id);
    setTab("cases");
    flash("dirty", `case ajoutee — pense a enregistrer`);
  }

  function patch(id: string, next: Partial<TreeNode>) {
    setTree({ ...tree, root: updateNode(tree.root, id, next) });
    flash("dirty", "modifications non enregistrees");
  }

  function rename(node: TreeNode, title: string) {
    patch(node.id, { title: title || "Sans titre", slug: uniqueSlug(title, editingSiblings, node.id) });
  }

  function remove(node: TreeNode) {
    if (
      !globalThis.confirm(
        `Retirer « ${node.title} »${node.kind === "folder" ? " et tout son contenu" : ""} ?`,
      )
    )
      return;
    setTree({ ...tree, root: removeId(tree.root, node.id) });
    if (editingId === node.id) setEditingId(null);
    flash("dirty", "case retiree — non enregistree");
  }

  function moveTo(id: string, targetPath: string[], index?: number) {
    const node = findNode(tree.root, id);
    if (!node) return;
    const nodePath = pathOfSlugs(tree.root, id) ?? [];
    if (
      nodePath.length &&
      targetPath.length >= nodePath.length &&
      nodePath.every((slug, i) => targetPath[i] === slug)
    ) {
      flash("err", "impossible de mettre un dossier dans lui-meme");
      return;
    }
    setTree(insertNode(tree, targetPath, node, index));
    flash("dirty", "deplacement effectue — non enregistre");
  }

  function handleDrop(target: TreeNode | null) {
    if (!dragId) return;
    const from = list.findIndex((n) => n.id === dragId);
    let index = list.length;
    if (target) {
      if (target.kind === "folder") {
        moveTo(dragId, [...path, target.slug]);
        setDragId(null);
        setDropId(null);
        return;
      }
      const to = list.findIndex((n) => n.id === target.id);
      index = to > from && from !== -1 ? to - 1 : to;
    }
    moveTo(dragId, path, index);
    setDragId(null);
    setDropId(null);
  }

  async function save() {
    flash("idle", "enregistrement...");
    try {
      const res = await fetch("/api/tree", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tree),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      flash("ok", "enregistre sur le stockage");
      router.refresh();
    } catch (error) {
      flash("err", error instanceof Error ? error.message : "echec de l'enregistrement");
    }
  }

  function applyRaw() {
    try {
      const parsed = normalize(JSON.parse(raw));
      setTree(parsed);
      setEditingId(null);
      flash("dirty", "json applique — non enregistre");
    } catch (error) {
      flash("err", `json invalide : ${error instanceof Error ? error.message : "?"}`);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    globalThis.location.href = "/";
  }

  return (
    <section className="console" aria-label="console admin">
      <div className="console-head">
        <div className="row">
          <span className="stamp">mode admin</span>
          <span className="status" data-tone={status.tone === "dirty" ? "err" : status.tone}>
            {status.msg || (dirty ? "non enregistre" : `stockage : ${storage}`)}
          </span>
        </div>
        <div className="row">
          <button className="btn primary" onClick={save} disabled={!dirty}>
            enregistrer
          </button>
          <Link className="btn ghost" href="/" target="_blank" rel="noopener">
            voir le site
          </Link>
          <button className="btn ghost" onClick={logout}>
            sortir
          </button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button
          role="tab"
          className="tab"
          aria-selected={tab === "cases"}
          onClick={() => setTab("cases")}
        >
          cases
        </button>
        <button
          role="tab"
          className="tab"
          aria-selected={tab === "json"}
          onClick={() => {
            setRaw(JSON.stringify(tree, null, 2));
            setTab("json");
          }}
        >
          json brut
        </button>
      </div>

      {tab === "json" ? (
        <div className="editor">
          <div className="field">
            <label htmlFor="raw">arbre complet</label>
            <textarea
              id="raw"
              className="json-editor"
              value={raw}
              spellCheck={false}
              onChange={(e) => setRaw(e.target.value)}
            />
          </div>
          <div className="row" style={{ marginTop: "0.8rem" }}>
            <button className="btn" onClick={applyRaw}>
              appliquer le json
            </button>
            <button className="btn ghost" onClick={() => setRaw(JSON.stringify(tree, null, 2))}>
              recharger depuis l'etat
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="field" style={{ maxWidth: 320, marginBottom: "0.9rem" }}>
            <label htmlFor="siteTitle">titre du site</label>
            <input
              id="siteTitle"
              value={tree.siteTitle}
              onChange={(e) => setTree({ ...tree, siteTitle: e.target.value })}
            />
          </div>
          <div className="field" style={{ marginBottom: "0.9rem" }}>
            <label htmlFor="siteTagline">ligne sous le titre</label>
            <input
              id="siteTagline"
              value={tree.siteTagline}
              onChange={(e) => setTree({ ...tree, siteTagline: e.target.value })}
            />
          </div>

          <div className="row" style={{ marginBottom: "0.9rem" }}>
            <span className="crumbs">
              <button className="btn ghost" onClick={() => setPath([])}>
                racine
              </button>
              {path.map((slug, i) => (
                <span key={slug}>
                  <span aria-hidden="true"> / </span>
                  <button className="btn ghost" onClick={() => setPath(path.slice(0, i + 1))}>
                    {slug}
                  </button>
                </span>
              ))}
            </span>
            <span style={{ flex: 1 }} />
            <button className="btn" onClick={() => create("link")}>
              + case
            </button>
            <button className="btn" onClick={() => create("folder")}>
              + dossier
            </button>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(null)}
            style={{ minHeight: 60 }}
          >
            {list.length === 0 ? (
              <p className="note-box">
                Ce niveau est vide. « + case » cree un lien sortant, « + dossier » cree un
                conteneur de cases.
              </p>
            ) : (
              list.map((node) => (
                <div
                  key={node.id}
                  className={`item${dragId === node.id ? " dragging" : ""}${
                    dropId === node.id ? " drop-before" : ""
                  }`}
                  draggable
                  onDragStart={() => setDragId(node.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropId(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropId(node.id);
                  }}
                  onDragLeave={() => setDropId((d) => (d === node.id ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDrop(node);
                  }}
                >
                  <span className="grip" aria-hidden="true">
                    ⠿
                  </span>
                  <span className="name" data-kind={node.kind}>
                    {node.title}
                  </span>
                  <span className="sub">
                    {node.kind === "folder"
                      ? `${node.children?.length ?? 0} cases`
                      : node.url || "aucune url"}
                  </span>
                  {node.kind === "folder" ? (
                    <button className="btn ghost" onClick={() => setPath([...path, node.slug])}>
                      ouvrir
                    </button>
                  ) : null}
                  <button
                    className="btn ghost"
                    onClick={() => setEditingId(editingId === node.id ? null : node.id)}
                  >
                    {editingId === node.id ? "fermer" : "editer"}
                  </button>
                  <button className="btn ghost danger" onClick={() => remove(node)}>
                    ×
                  </button>

                  {editingId === node.id ? (
                    <NodeEditor
                      node={node}
                      nodePath={[...path, node.slug]}
                      folders={folders}
                      onPatch={(next) => patch(node.id, next)}
                      onRename={(title) => rename(node, title)}
                      onMove={(targetPath) => moveTo(node.id, targetPath)}
                    />
                  ) : null}
                </div>
              ))
            )}
          </div>

          <p className="note-box" style={{ marginTop: "1rem" }}>
            Glisse une case sur une autre pour la placer avant&nbsp;; glisse-la sur un dossier pour
            l'y ranger&nbsp;; depose-la sous la liste pour aller a la fin.
          </p>

          <div style={{ marginTop: "2.4rem" }}>
            <p className="masthead-meta" style={{ textAlign: "left", marginBottom: "1rem" }}>
              <span>apercu — tel que ce niveau sera publie</span>
            </p>
            <Board nodes={list} path={path} />
          </div>
        </>
      )}
    </section>
  );
}

function NodeEditor({
  node,
  nodePath,
  folders,
  onPatch,
  onRename,
  onMove,
}: {
  node: TreeNode;
  nodePath: string[];
  folders: { path: string[]; label: string }[];
  onPatch: (patch: Partial<TreeNode>) => void;
  onRename: (title: string) => void;
  onMove: (path: string[]) => void;
}) {
  return (
    <div className="editor" style={{ width: "100%", marginTop: "0.6rem" }}>
      <div className="row">
        <div className="field">
          <label>titre</label>
          <input value={node.title} onChange={(e) => onRename(e.target.value)} />
        </div>
        <div className="field">
          <label>url</label>
          <input
            disabled={node.kind === "folder"}
            value={node.url ?? ""}
            placeholder="https://..."
            onChange={(e) => onPatch({ url: e.target.value })}
          />
        </div>
      </div>
      <div className="row" style={{ marginTop: "0.7rem" }}>
        <div className="field" style={{ flexBasis: "100%" }}>
          <label>note (une ou deux lignes)</label>
          <textarea
            disabled={node.kind === "folder"}
            value={node.note ?? ""}
            onChange={(e) => onPatch({ note: e.target.value })}
          />
        </div>
      </div>
      <div className="row" style={{ marginTop: "0.7rem" }}>
        <div className="field">
          <label>etiquettes (separees par des virgules)</label>
          <input
            disabled={node.kind === "folder"}
            value={(node.tags ?? []).join(", ")}
            onChange={(e) =>
              onPatch({
                tags: e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
        <div className="field">
          <label>déplacer vers</label>
          <select
            onChange={(e) => {
              const target = folders[Number(e.target.value)];
              if (target) onMove(target.path);
            }}
            defaultValue=""
          >
            <option value="" disabled>
              choisir un dossier
            </option>
            {folders.map((folder, i) => (
              <option key={folder.label} value={i}>
                {folder.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="note-box" style={{ marginTop: "0.8rem" }}>
        adresse publique&nbsp;:{" "}
        {node.kind === "folder" ? `/f/${nodePath.join("/")}` : node.url || "—"}
      </p>
    </div>
  );
}

function removeId(nodes: TreeNode[], id: string): TreeNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) =>
      node.kind === "folder" ? { ...node, children: removeId(node.children ?? [], id) } : node,
    );
}
