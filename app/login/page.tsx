import Link from "next/link";
import { Masthead } from "@/components/Board";
import { loadPortfolio } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const portfolio = await loadPortfolio();
  const message = error === "1" ? "Mot de passe refuse." : null;
  const warning = process.env.ADMIN_PASSWORD
    ? null
    : "ADMIN_PASSWORD n'est pas defini. Renseigne-le dans .env.local (dev) ou dans les variables d'environnement Vercel.";

  return (
    <main className="shell">
      <Masthead portfolio={{ ...portfolio, siteTagline: "acces reserve" }} />
      <form className="login" method="post" action="/api/session">
        <span className="stamp">clé requise</span>
        <h1>Console</h1>
        <p className="note-box">
          Le tableau est public en lecture. Seule la personne qui connait le mot de passe peut
          poser, déplacer ou retirer des cases.
        </p>
        <div className="field">
          <label htmlFor="password">mot de passe admin</label>
          <input id="password" name="password" type="password" autoFocus required />
        </div>
        {warning ? <p className="status" data-tone="err">{warning}</p> : null}
        {message ? <p className="status" data-tone="err">{message}</p> : null}
        <div className="row">
          <button className="btn primary" type="submit">
            entrer
          </button>
          <Link className="btn ghost" href="/">
            retour au tableau
          </Link>
        </div>
      </form>
    </main>
  );
}
