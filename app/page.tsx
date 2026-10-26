import { Board, Masthead } from "@/components/Board";
import { loadPortfolio } from "@/lib/store";

export const revalidate = 20;

export default async function Home() {
  const portfolio = await loadPortfolio();
  return (
    <main className="shell">
      <Masthead portfolio={portfolio} />
      <Board nodes={portfolio.root} />
      <footer className="foot">
        <span>tableau vide jusqu'à la première case</span>
        <span>vercel · blob · admin</span>
      </footer>
    </main>
  );
}
