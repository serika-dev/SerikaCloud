import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

/**
 * Apps that live on their own subdomain and map to an internal route segment
 * (e.g. `mail.serika.dev/inbox` -> internal `/mail/inbox`).
 *
 * NOTE: "cloud" is intentionally NOT in this list. SerikaCloud is the default
 * app and is served straight from the route root (`src/app/(dashboard)`), so it
 * needs no rewrite. `cloud.serika.dev`, the apex domain and `www.` all resolve
 * to the default app.
 */
const SUBDOMAIN_APPS = ["write", "mail", "present"] as const;
type SubApp = (typeof SUBDOMAIN_APPS)[number];
const SUBDOMAIN_APP_SET: ReadonlySet<string> = new Set(SUBDOMAIN_APPS);

/**
 * Registrable root domain the suite is served from. Configurable so the same
 * build works for staging / preview / custom base domains. Leading/trailing dots
 * are tolerated in the env value.
 */
const ROOT_DOMAIN = (process.env.APP_ROOT_DOMAIN || "serika.dev")
  .trim()
  .toLowerCase()
  .replace(/^\.+/, "")
  .replace(/\.+$/, "");

/** Left-most labels that always mean "the default (cloud) app", never a sub-app. */
const DEFAULT_APP_LABELS: ReadonlySet<string> = new Set([
  "cloud",
  "www",
  "app",
]);

/** Static-ish files that must never be rewritten or auth-gated as pages. */
const PUBLIC_FILE =
  /\.(?:ico|png|jpe?g|gif|svg|webp|avif|bmp|css|js|mjs|map|txt|xml|json|webmanifest|woff2?|ttf|otf|eot|mp[34]|wav|ogg|webm|pdf)$/i;

/**
 * Resolve the externally-visible hostname.
 *
 * Behind a reverse proxy / ingress (Coolify + Traefik, nginx, Cloudflare, ...)
 * the original browser host arrives in `x-forwarded-host`; the `host` header can
 * be the internal upstream (`localhost:3000`, a container name, ...). We must
 * prefer the forwarded value or every `*.serika.dev` sub-app silently falls back
 * to the default app. `trustHost: true` is already set in the auth config, so
 * trusting these headers here is consistent with the rest of the stack.
 */
function resolveHostname(req: {
  headers: { get(name: string): string | null };
  nextUrl: { hostname: string };
}): string {
  const raw =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    req.nextUrl.hostname ||
    "";
  // `x-forwarded-host` may be a comma-separated chain ("edge, origin").
  const first = raw.split(",")[0].trim().toLowerCase();
  // Strip port and any trailing dot (fully-qualified form).
  return first.replace(/:\d+$/, "").replace(/\.$/, "");
}

/**
 * Normalise a pathname to a guaranteed same-origin, single-slash-rooted path.
 *
 * `req.nextUrl.pathname` preserves a leading slash run: a request to
 * `https://cloud.serika.dev//evil.com` has pathname `//evil.com`. Anything that
 * later resolves such a value as a URL (`new URL(v, base)`, `router.push(v)`,
 * `<a href>`) treats it as protocol-relative and leaves the origin. Collapsing
 * the leading `/` or `\` run to a single `/` makes that impossible, so the
 * `callbackUrl` we hand to the login page can never become an off-site redirect.
 */
function toSafePath(pathname: string): string {
  return `/${pathname.replace(/^[/\\]+/, "")}`;
}

/**
 * Map a hostname to a sub-app, or `null` for the default app.
 *
 * Uses suffix matching against ROOT_DOMAIN rather than a brittle
 * `split(".")[0]` / `parts.length >= 3` check, so it copes with:
 *   - the apex domain and `www.` / `cloud.` / `app.`  -> default app
 *   - multi-level hosts (`mail.staging.serika.dev`)   -> `mail`
 *   - trailing-dot FQDNs and ports (already stripped by resolveHostname)
 *   - unknown base domains (custom org domains, preview URLs): the left-most
 *     label is still honoured when it names a known sub-app, so
 *     `mail.customdomain.com` -> `mail`; anything else -> default app.
 *
 * The return value is always a member of SUBDOMAIN_APPS or null — callers may
 * interpolate it into a path without further validation.
 */
function getSubApp(hostname: string): SubApp | null {
  if (!hostname) return null;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return null;
  // Bare IPv4 or IPv6 literal -> no subdomain concept.
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")) {
    return null;
  }

  let label: string | null = null;

  if (hostname === ROOT_DOMAIN) {
    label = null; // apex
  } else if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const prefix = hostname.slice(0, hostname.length - ROOT_DOMAIN.length - 1);
    label = prefix.split(".")[0] || null;
  } else {
    // Unknown base domain: only honour a leading label that is an explicit
    // known sub-app; anything else is treated as the default app.
    const parts = hostname.split(".");
    label = parts.length >= 3 ? parts[0] : null;
  }

  if (!label || DEFAULT_APP_LABELS.has(label)) return null;
  return SUBDOMAIN_APP_SET.has(label) ? (label as SubApp) : null;
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const search = req.nextUrl.search;

  // ---- 1. Never touch framework internals or static assets. -----------------
  // The matcher already excludes most of these; this is defense-in-depth so a
  // sub-app host can never rewrite `/Logo.svg` -> `/mail/Logo.svg` (404) or
  // redirect an asset request to the login page.
  if (pathname.startsWith("/_next") || PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");
  const isApiRoute = pathname.startsWith("/api");
  const isShareRoute = pathname.startsWith("/share");

  const hostname = resolveHostname(req);

  // The `?app=` override is a local-dev affordance, but it is attacker
  // controllable, so validate it against the known app list *here* rather than
  // at each use site. `subApp` is therefore only ever a real sub-app or null,
  // and interpolating it into a path is safe by construction.
  //
  // Without this, `/login?app=//evil.com` produced
  // `new URL("///evil.com", req.url)` === "https://evil.com/" — an open
  // redirect for any logged-in user who followed the link.
  const appParam = req.nextUrl.searchParams.get("app");
  const subApp: SubApp | null =
    getSubApp(hostname) ??
    (appParam !== null && SUBDOMAIN_APP_SET.has(appParam)
      ? (appParam as SubApp)
      : null);

  // ---- 2. API + public share links: always pass through, on any host. -------
  // These do their own auth (session, bearer token, or none) and must stay
  // reachable from every subdomain (e.g. the SES/MTA webhook may hit
  // mail.serika.dev/api/mail/incoming).
  if (isApiRoute || isShareRoute) {
    return NextResponse.next();
  }

  // ---- 3. Auth pages. ------------------------------------------------------
  if (isAuthPage) {
    if (isLoggedIn) {
      // Drop the user into the app for the host they are actually on.
      return NextResponse.redirect(new URL(subApp ? `/${subApp}` : "/", req.url));
    }
    return NextResponse.next();
  }

  // ---- 4. Everything else is an authenticated app page. ------------------
  if (!isLoggedIn) {
    const callbackUrl = encodeURIComponent(toSafePath(pathname) + search);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
    );
  }

  // ---- 5. Sub-app host: rewrite host-root path -> internal route segment. ---
  if (subApp) {
    const alreadyScoped =
      pathname === `/${subApp}` || pathname.startsWith(`/${subApp}/`);

    if (!alreadyScoped) {
      const url = req.nextUrl.clone();
      url.pathname = `/${subApp}${pathname === "/" ? "" : pathname}`;
      url.searchParams.delete("app"); // strip the dev-only selector
      return NextResponse.rewrite(url);
    }
    // Request already targets `/mail/...` on the sub-app host -> serve as-is.
    return NextResponse.next();
  }

  // ---- 6. Default (cloud) app. ------------------------------------------
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Run on everything except Next internals, well-known static files and the
    // large-body upload endpoint (which must not be buffered by middleware).
    "/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|api/files/upload).*)",
  ],
};
