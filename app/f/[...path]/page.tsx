import { notFound, redirect } from "next/navigation";
import { Board, Crumbs, Masthead } from "@/components/Board";
import { loadPortfolio } from "@/lib/store";
import { nodeAt } from "@/lib/tree";

export const dynamic = "force-dynamic";

export default async function FolderPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const portfolio = await loadPortfolio();
  const node = nodeAt(portfolio, path);
  if (!node) notFound();
  if (node.kind === "link") {
    if (node.url) redirect(node.url);
    notFound();
  }

  return (
    <main className="shell">
      <Masthead portfolio={portfolio} />
      <div className="indexbar">
        <Crumbs path={path} />
        <span>
          {node.children?.length ?? 0} cases · {node.title}
        </span>
      </div>
      <Board nodes={node.children ?? []} path={path} />
      <footer className="foot">
        <span>dossier</span>
        <span>/f/{path.join("/")}</span>
      </footer>
    </main>
  );
}
