import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/AdminConsole";
import { Masthead } from "@/components/Board";
import { isAuthenticated } from "@/lib/auth";
import { loadPortfolio, storageMode } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAuthenticated())) redirect("/login");
  const portfolio = await loadPortfolio();

  return (
    <main className="shell">
      <Masthead portfolio={portfolio} />
      <AdminConsole initial={portfolio} storage={storageMode()} />
    </main>
  );
}
