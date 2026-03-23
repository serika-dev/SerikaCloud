import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const SUBDOMAIN_APPS = ["write", "mail", "present"] as const;

function getSubdomain(hostname: string): string | null {
  // Local development: check for ?app= query param or x-app header
  if (hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
    return null; // handled via query param in dev
  }

  // Production: extract subdomain from hostname
  // e.g., write.serika.dev → write, mail.serika.dev → mail
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const sub = parts[0];
    if (SUBDOMAIN_APPS.includes(sub as any)) {
      return sub;
    }
  }
  return null;
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");
  const isApiRoute = pathname.startsWith("/api");
  const isShareRoute = pathname.startsWith("/share");

  // Detect subdomain
  const subdomain = getSubdomain(hostname) || req.nextUrl.searchParams.get("app");

  // Rewrite subdomain routes to internal paths
  // e.g., docs.serika.dev/ → /docs/, mail.serika.dev/inbox → /mail/inbox
  if (subdomain && SUBDOMAIN_APPS.includes(subdomain as any)) {
    // Don't rewrite if already on the correct internal path
    if (!pathname.startsWith(`/${subdomain}`) && !isApiRoute && !isAuthPage) {
      const url = req.nextUrl.clone();
      url.pathname = `/${subdomain}${pathname}`;
      // Remove the app query param in dev
      url.searchParams.delete("app");

      // Auth check before rewriting
      if (!isLoggedIn) {
        const callbackUrl = encodeURIComponent(pathname + req.nextUrl.search);
        return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, req.url));
      }

      return NextResponse.rewrite(url);
    }
  }

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
    const callbackUrl = encodeURIComponent(pathname + req.nextUrl.search);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/files/upload).*)"],
};
