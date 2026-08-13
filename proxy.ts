import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, isValidSession } from "./lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const ok = await isValidSession(token);

  if (pathname === "/imo" || pathname.startsWith("/imo/")) {
    return NextResponse.next();
  }

  if (pathname === "/masuk" || pathname.startsWith("/api/auth/login")) {
    if (ok && pathname === "/masuk") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!ok) {
    const url = new URL("/masuk", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
