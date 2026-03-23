import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/register");
  const isApiRoute = req.nextUrl.pathname.startsWith("/api");
  const isShareRoute = req.nextUrl.pathname.startsWith("/share");

  // Allow API routes, share routes, and static files
  if (isApiRoute || isShareRoute) {
    return NextResponse.next();
  }

  // Redirect authenticated users away from auth pages
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/files/upload).*)"],
};
