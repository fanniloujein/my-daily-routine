import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, homeForRole, requiredRoleForPath, verifySession } from "@/lib/auth/token";

/**
 * Première barrière (Edge) : jeton valide et rôle correspondant au préfixe.
 * Chaque layout et chaque action revérifient ensuite l'utilisateur en base.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const role = requiredRoleForPath(pathname);
  if (!role) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (session.role !== role) {
    const url = req.nextUrl.clone();
    url.pathname = homeForRole(session.role);
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/teacher/:path*", "/admin/:path*"],
};
