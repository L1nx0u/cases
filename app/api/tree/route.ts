import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { loadPortfolio, savePortfolio, storageMode } from "@/lib/store";
import { isSafeUrl, normalize, type Portfolio } from "@/lib/tree";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function urlProblem(portfolio: Portfolio): string | null {
  const walk = (nodes: Portfolio["root"]): string | null => {
    for (const node of nodes) {
      if (node.kind === "link" && node.url && !isSafeUrl(node.url)) return node.url;
      if (node.kind === "folder") {
        const hit = walk(node.children ?? []);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(portfolio.root);
}

export async function GET() {
  const portfolio = await loadPortfolio();
  return NextResponse.json({ portfolio, storage: storageMode() });
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Session admin requise." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const portfolio = normalize(body);
  const badUrl = urlProblem(portfolio);
  if (badUrl) {
    return NextResponse.json(
      { error: `URL refusee (http/mailto uniquement) : ${badUrl}` },
      { status: 400 },
    );
  }

  try {
    await savePortfolio(portfolio);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ecriture impossible";
    return NextResponse.json({ error: `Enregistrement impossible : ${message}` }, { status: 500 });
  }

  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, storage: storageMode() });
}
