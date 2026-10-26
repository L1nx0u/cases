import Link from "next/link";
import { HandRule, tiltOf } from "./deco";
import { countLinks, hostOf, isRepo, type Portfolio, type TreeNode } from "@/lib/tree";

const EMPTY_LABELS = ["case", "vide", "—", "vide", "case"];

export function Masthead({ portfolio }: { portfolio: Portfolio }) {
  const total = portfolio.root.reduce((sum, n) => sum + countLinks(n), 0);
  return (
    <header className="masthead">
      <div className="masthead-top">
        <h1 className="wordmark">
          <Link href="/">
            cas<em>e</em>s
          </Link>
        </h1>
        <div className="masthead-meta">
          <span>tableau de travail</span>
          <span>
            {total} {total === 1 ? "lien" : "liens"} indexés
          </span>
          <Link className="keyhole" href="/admin">
            ⌘ admin
          </Link>
        </div>
      </div>
      <p className="tagline">{portfolio.siteTagline}</p>
      <HandRule />
    </header>
  );
}

export function Crumbs({ path }: { path: string[] }) {
  if (path.length === 0) return null;
  return (
    <nav className="crumbs" aria-label="chemin">
      <Link href="/">racine</Link>
      {path.map((slug, i) => {
        const href = `/f/${path.slice(0, i + 1).join("/")}`;
        const last = i === path.length - 1;
        return (
          <span key={slug}>
            <span aria-hidden="true"> / </span>
            {last ? <strong>{slug}</strong> : <Link href={href}>{slug}</Link>}
          </span>
        );
      })}
    </nav>
  );
}

export function Card({ node, index, path }: { node: TreeNode; index: number; path: string[] }) {
  const href = node.kind === "folder" ? `/f/${[...path, node.slug].join("/")}` : node.url || "";
  const folderCount = node.kind === "folder" ? countLinks(node) : 0;
  const style = { "--i": index, "--tilt": `${tiltOf(node.slug)}deg` } as React.CSSProperties;

  const inner = (
    <>
      <span className="cell-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="cell-kind" data-kind={node.kind}>
        {node.kind === "folder" ? "dossier" : "lien"}
      </span>
      <h3 className="cell-title">{node.title}</h3>
      {node.note ? <p className="cell-note">{node.note}</p> : null}
      {node.tags && node.tags.length > 0 ? (
        <div className="cell-tags">
          {node.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <div className="cell-foot">
        <span className="host">
          {node.kind === "folder"
            ? `${node.children?.length ?? 0} cases · ${folderCount} ${folderCount === 1 ? "lien" : "liens"}`
            : `${isRepo(node.url) ? "github · " : ""}${hostOf(node.url) || "destination à venir"}`}
        </span>
        <span className="arrow" aria-hidden="true">
          {node.kind === "folder" ? "→" : "↗"}
        </span>
      </div>
    </>
  );

  const className = "cell";

  if (node.kind === "folder") {
    return (
      <a className={className} style={style} href={href}>
        {inner}
      </a>
    );
  }

  if (!node.url) {
    return (
      <div className={className} style={style}>
        {inner}
      </div>
    );
  }

  const external = /^https?:/i.test(node.url);
  return (
    <a
      className={className}
      style={style}
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {inner}
    </a>
  );
}

export function Board({ nodes, path = [] }: { nodes: TreeNode[]; path?: string[] }) {
  if (nodes.length === 0) {
    return (
      <div className="grid">
        <div className="empty-brief">
          <h2>Rien n'est posé ici.</h2>
          <p>
            Le tableau est vide par conception. Les cases n'existent que quand je les crée —
            un lien vers un site, ou un dossier qui en contient d'autres. Le reste du monde ne
            voit que ces emplacements pointillés.
          </p>
        </div>
        {EMPTY_LABELS.map((label, i) => (
          <div className="slot" style={{ "--i": i } as React.CSSProperties} key={`${label}-${i}`}>
            <span className="dash" aria-hidden="true">
              ▢
            </span>
            <span>case vide</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid">
      {nodes.map((node, i) => (
        <Card key={node.id} node={node} index={i} path={path} />
      ))}
    </div>
  );
}
