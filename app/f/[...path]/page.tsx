import { notFound, redirect } from "next/navigation";
import { BoardApp } from "@/components/BoardApp";
import { isAuthenticated } from "@/lib/auth";
import { load, storageMode } from "@/lib/store";
import { nodeAt } from "@/lib/tree";

export const dynamic = "force-dynamic";

export default async function FolderPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const [{ portfolio, version }, admin] = await Promise.all([load(), isAuthenticated()]);
  const node = nodeAt(portfolio, path);

  if (!node) notFound();
  if (node.kind === "link") {
    if (node.url) redirect(node.url);
    notFound();
  }

  return (
    <BoardApp
      initial={portfolio}
      initialVersion={version}
      admin={admin}
      storage={storageMode()}
      initialPath={path}
    />
  );
}
