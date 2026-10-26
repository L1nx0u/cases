import {
  hueOf,
  hostOf,
  isImageUrl,
  monogram,
  type TreeNode,
} from "@/lib/tree";

function FolderGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none">
      <path
        d="M3 7.2c0-1 .8-1.7 1.8-1.7h3.3c.6 0 1.1.25 1.5.7l1 1.2h8C19.6 7.6 20.4 8.4 20.4 9.3v7.9c0 1-.8 1.8-1.8 1.8H4.8c-1 0-1.8-.8-1.8-1.8V7.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M3 11h17.4" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
    </svg>
  );
}

export function CardIcon({ node }: { node: TreeNode }) {
  const icon = node.icon?.trim();
  if (icon && isImageUrl(icon)) {
    return (
      <span className="card-icon">
        <img src={icon} alt="" loading="lazy" />
      </span>
    );
  }
  if (icon) return <span className="card-icon card-icon--emoji">{icon}</span>;
  if (node.kind === "folder") {
    return (
      <span className="card-icon card-icon--folder">
        <FolderGlyph />
      </span>
    );
  }
  return (
    <span className="card-icon card-icon--mono" style={{ "--h": hueOf(node.slug) } as React.CSSProperties}>
      {monogram(node)}
    </span>
  );
}

export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="logo" href="/" data-nav>
          <span className="logo-dot" aria-hidden="true" />
          cases
        </a>
        {children}
      </div>
    </header>
  );
}

export function Breadcrumbs({ path }: { path: string[] }) {
  return (
    <nav className="crumbs" aria-label="emplacement">
      <a href="/" data-nav aria-current={path.length === 0 ? "page" : undefined}>
        tableau
      </a>
      {path.map((slug, i) => {
        const href = `/f/${path.slice(0, i + 1).join("/")}`;
        const last = i === path.length - 1;
        return (
          <span key={slug} style={{ display: "inline-flex", gap: "0.3rem", alignItems: "center" }}>
            <span aria-hidden="true">/</span>
            <a href={href} data-nav aria-current={last ? "page" : undefined}>
              {slug}
            </a>
          </span>
        );
      })}
    </nav>
  );
}

export function Card({
  node,
  path,
  index,
  query = "",
  admin = false,
  pathLabel,
  onEdit,
}: {
  node: TreeNode;
  path: string[];
  index: number;
  query?: string;
  admin?: boolean;
  pathLabel?: string | null;
  onEdit?: (id: string) => void;
}) {
  const nodePath = [...path, node.slug];
  const isFolder = node.kind === "folder";
  const href = isFolder ? `/f/${nodePath.join("/")}` : node.url || "";
  const host = hostOf(node.url);

  const body = (
    <article
      className="card"
      style={{ "--i": index } as React.CSSProperties}
      data-kind={node.kind}
      data-has-url={isFolder ? undefined : String(Boolean(node.url))}
    >
      <div className="card-top">
        {!isFolder ? <CardIcon node={node} /> : null}
        <span className="chip" data-kind={node.kind}>
          {isFolder
            ? `${node.children?.length ?? 0} ${node.children?.length === 1 ? "case" : "cases"}`
            : "lien"}
        </span>
        {!isFolder && host ? <span className="card-host">{host}</span> : null}
      </div>

      {pathLabel ? <span className="card-path">dans {pathLabel}</span> : null}

      <h3 className="card-title">
        <Highlight text={node.title} query={query} />
      </h3>

      {node.note ? (
        <p className="card-note">
          <Highlight text={node.note} query={query} />
        </p>
      ) : null}

      {node.tags && node.tags.length > 0 ? (
        <div className="card-tags">
          {node.tags.map((tag) => (
            <span className="tag" key={tag}>
              #{tag}
            </span>
          ))}
        </div>
      ) : null}

      <span className="card-arrow" aria-hidden="true">
        {isFolder ? "→" : "↗"}
      </span>

      {href ? (
        <a
          className="card-hit"
          href={href}
          {...(isFolder
            ? { "data-nav": nodePath.join("/"), "aria-label": `Ouvrir le dossier ${node.title}` }
            : { target: "_blank", rel: "noopener noreferrer", "aria-label": `Ouvrir ${node.title}` })}
        />
      ) : null}

      {admin ? (
        <div className="card-actions">
          <button className="icon-btn" onClick={() => onEdit?.(node.id)} aria-label={`Modifier ${node.title}`}>
            ✎
          </button>
        </div>
      ) : null}
    </article>
  );

  if (!isFolder) return body;

  return (
    <div className="folder-shell" style={{ "--i": index } as React.CSSProperties}>
      {body}
      <span className="folder-flap" aria-hidden="true" />
    </div>
  );
}
