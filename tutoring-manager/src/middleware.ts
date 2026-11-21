import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Toutes les pages et API sont privées, sauf la connexion et la création du compte.
const PUBLIC = ["/login", "/setup", "/api/auth/login", "/api/auth/setup", "/api/health", "/favicon", "/icon"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (s) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Session expirée : reconnectez-vous." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|svg|ico)$).*)"] };
