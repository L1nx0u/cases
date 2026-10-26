import { NextResponse } from "next/server";
import { checkPassword, isAuthenticated, makeToken, rateLimit, sessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ authenticated: await isAuthenticated() });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let password = "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { password?: string };
    password = String(body.password ?? "");
  } else {
    const form = await request.formData().catch(() => null);
    password = String(form?.get("password") ?? "");
  }

  const key = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(key)) {
    return NextResponse.json({ error: "Trop de tentatives. Reessa dans dix minutes." }, { status: 429 });
  }

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD n'est pas defini cote serveur." },
      { status: 500 },
    );
  }

  const acceptsHtml = (request.headers.get("accept") ?? "").includes("text/html");

  if (!checkPassword(password)) {
    if (acceptsHtml) return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  const cookie = sessionCookie(makeToken());
  const response = acceptsHtml
    ? NextResponse.redirect(new URL("/admin", request.url), 303)
    : NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    secure: cookie.secure,
    path: cookie.path,
    maxAge: cookie.maxAge,
  });
  return response;
}
