import { TopBar } from "@/components/Chrome";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error === "1" ? "Mot de passe refuse." : null;
  const warning = process.env.ADMIN_PASSWORD
    ? null
    : "ADMIN_PASSWORD n'est pas defini cote serveur.";

  return (
    <>
      <TopBar />
      <main className="shell">
        <div className="center">
          <form className="panel" method="post" action="/api/session">
            <h1>Console d'edition</h1>
            <p>
              Le tableau est public en lecture. Seule la personne qui connait le mot de passe peut
              poser, deplacer ou retirer des cases.
            </p>
            <div className="field">
              <label htmlFor="password">mot de passe admin</label>
              <input id="password" name="password" type="password" autoFocus required />
            </div>
            {warning ? <span className="err">{warning}</span> : null}
            {message ? <span className="err">{message}</span> : null}
            <button className="btn primary" type="submit">
              entrer
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
