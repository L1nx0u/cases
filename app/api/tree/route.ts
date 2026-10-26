import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { load, savePortfolio, storageMode } from "@/lib/store";
import { isSafeUrl, normalize, versionOf, type Portfolio } from "@/lib/tree";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function urlProblem(portfolio: Portfolio): string | null {
  const walk = (nodes: Portfolio["root"]): string | null => {
    for (const node of nodes) {
      if (node.kind === "link" && node.url && !isSafeUrl(node.url)) return node.url;
      if (node.icon && /^https?:\/\//i.test(node.icon) && !isSafeUrl(node.icon)) return node.icon;
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
  const { portfolio, version } = await load();
  return NextResponse.json({ portfolio, version, storage: storageMode() });
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Session admin requise." }, { status: 401 });
  }

  const raw = (await request.json().catch(() => null)) as
    | { portfolio?: unknown; version?: string }
    | null;
  if (!raw || !raw.portfolio || typeof raw.portfolio !== "object") {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const incoming = normalize(raw.portfolio);
  const badUrl = urlProblem(incoming);
  if (badUrl) {
    return NextResponse.json(
      { error: `URL refusee (http/mailto uniquement) : ${badUrl}` },
      { status: 400 },
    );
  }

  // Le client renvoie la version chargee. Sans correspondance, on refuse : un vieil
  // onglet ne doit pas pouvoir ecrire par-dessus le travail d'une autre session.
  const incomingVersion = versionOf(incoming);
  const current = await load();
  const blindOverwrite =
    typeof raw.version === "string" &&
    raw.version !== current.version &&
    incomingVersion !== current.version;
  if (blindOverwrite) {
    return NextResponse.json(
      { error: "conflict", conflict: true, version: current.version, portfolio: current.portfolio },
      { status: 409 },
    );
  }

  try {
    await savePortfolio(incoming);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ecriture impossible";
    return NextResponse.json({ error: `Enregistrement impossible : ${message}` }, { status: 500 });
  }

  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, storage: storageMode(), version: incomingVersion });
}
