import { TopBar } from "@/components/Chrome";

export default function NotFound() {
  return (
    <>
      <TopBar />
      <main className="shell">
        <section className="head">
          <p className="crumbs">404</p>
          <h1>Cette case n'existe pas</h1>
          <p>Elle n'a jamais été posée, ou elle a été retirée du tableau.</p>
        </section>
        <p>
          <a className="btn primary" href="/">
            ← retour au tableau
          </a>
        </p>
      </main>
    </>
  );
}
