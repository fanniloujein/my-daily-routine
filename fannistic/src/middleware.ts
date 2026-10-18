import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const LOCALES = ["fr", "en", "ar"];
const SESSION_COOKIE = "fs_session";

function preferredLocale(req: NextRequest) {
  const cookie = req.cookies.get("fs_locale")?.value;
  if (cookie && LOCALES.includes(cookie)) return cookie;
  const accept = req.headers.get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (LOCALES.includes(code)) return code;
  }
  return "fr";
}

async function isAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-secret-change-me-please");
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload.role === "ADMIN";
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Administration : français, accès réservé (contrôle complet refait côté serveur).
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname !== "/admin/connexion" && !(await isAdmin(req))) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/connexion";
      url.search = "";
      return NextResponse.redirect(url);
    }
    const h = new Headers(req.headers);
    h.set("x-locale", "fr");
    return NextResponse.next({ request: { headers: h } });
  }

  const seg = pathname.split("/")[1];
  if (LOCALES.includes(seg)) {
    const h = new Headers(req.headers);
    h.set("x-locale", seg);
    const res = NextResponse.next({ request: { headers: h } });
    if (req.cookies.get("fs_locale")?.value !== seg) {
      res.cookies.set("fs_locale", seg, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    return res;
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${preferredLocale(req)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next|icon.svg|opengraph-image|robots.txt|sitemap.xml|favicon.ico|logo-mark.svg).*)"],
};
