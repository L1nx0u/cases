import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell" style={{ padding: "18vh 0" }}>
      <p className="masthead-meta" style={{ textAlign: "left" }}>
        <span>404</span>
      </p>
      <h1 className="wordmark" style={{ fontSize: "clamp(2.5rem,9vw,5rem)" }}>
        cette case n'existe pas
      </h1>
      <p className="tagline">
        Elle n'a jamais été posée, ou elle a été retirée du tableau.
      </p>
      <p style={{ marginTop: "2rem" }}>
        <Link className="keyhole" href="/">
          ← retour au tableau
        </Link>
      </p>
    </main>
  );
}
