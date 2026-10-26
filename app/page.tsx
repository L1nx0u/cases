import { BoardApp } from "@/components/BoardApp";
import { isAuthenticated } from "@/lib/auth";
import { load, storageMode } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ portfolio, version }, admin] = await Promise.all([load(), isAuthenticated()]);
  return (
    <BoardApp
      initial={portfolio}
      initialVersion={version}
      admin={admin}
      storage={storageMode()}
      initialPath={[]}
    />
  );
}
