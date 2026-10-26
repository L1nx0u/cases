import type { TreeNode } from "./tree";

export function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.kind === "folder") {
      const hit = findNode(node.children ?? [], id);
      if (hit) return hit;
    }
  }
  return null;
}

export function updateNode(nodes: TreeNode[], id: string, patch: Partial<TreeNode>): TreeNode[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, ...patch };
    if (node.kind === "folder") {
      return { ...node, children: updateNode(node.children ?? [], id, patch) };
    }
    return node;
  });
}

export interface FolderOption {
  path: string[];
  label: string;
}

export function listFolders(nodes: TreeNode[], trail: string[] = []): FolderOption[] {
  const out: FolderOption[] = [];
  for (const node of nodes) {
    if (node.kind !== "folder") continue;
    const path = [...trail, node.slug];
    out.push({ path, label: path.join(" / ") });
    out.push(...listFolders(node.children ?? [], path));
  }
  return out;
}

export function siblingsOf(portfolio: { root: TreeNode[] }, path: string[]): TreeNode[] {
  let list = portfolio.root;
  for (const slug of path) {
    const found = list.find((n) => n.slug === slug && n.kind === "folder");
    list = found?.children ?? [];
  }
  return list;
}
