import { BoardApp } from "@/components/BoardApp";
import { isAuthenticated } from "@/lib/auth";
import { loadPortfolio, storageMode } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [portfolio, admin] = await Promise.all([loadPortfolio(), isAuthenticated()]);
  return <BoardApp initial={portfolio} admin={admin} storage={storageMode()} initialPath={[]} />;
}
