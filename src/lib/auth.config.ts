import type { NextAuthConfig } from "next-auth";

/**
 * Cross-subdomain SSO for the Serika suite.
 *
 * The suite is served from several hosts that must share ONE auth session:
 *   cloud.serika.dev · write.serika.dev · mail.serika.dev · present.serika.dev
 *
 * By default Auth.js scopes the session cookie to the exact host that issued it,
 * so a login on `cloud.serika.dev` is not recognised on `mail.serika.dev` and
 * the routing middleware bounces the user back to `/login` on every subdomain
 * hop. Giving the cookie an explicit parent `domain` (leading dot) makes the
 * session valid for every subdomain.
 *
 * Resolution order:
 *   1. `AUTH_COOKIE_DOMAIN` (e.g. ".serika.dev") — always wins. Set this
 *      explicitly for multi-part public suffixes such as ".example.co.uk".
 *      The values "none" / "off" / "host" force host-only (opt back out of the
 *      auto-derivation below).
 *   2. Derived from `NEXTAUTH_URL` when it points at a subdomain host
 *      (>= 3 labels, not an IP / not localhost) -> "." + last two labels.
 *   3. Otherwise `undefined` -> Auth.js default (host-only cookie, unchanged
 *      behaviour — zero risk for single-domain deployments).
 */
function resolveCookieDomain(): string | undefined {
  const explicit = process.env.AUTH_COOKIE_DOMAIN?.trim().toLowerCase();
  if (explicit === "none" || explicit === "off" || explicit === "host") {
    return undefined;
  }
  if (explicit) return explicit.startsWith(".") ? explicit : `.${explicit}`;

  const raw = process.env.NEXTAUTH_URL?.trim();
  if (!raw) return undefined;

  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return undefined;
  }

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.includes(":") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
  ) {
    return undefined;
  }

  const labels = host.split(".");
  // Only auto-share when NEXTAUTH_URL is itself on a subdomain (foo.bar.tld).
  // For an apex host (bar.tld) stay host-only unless AUTH_COOKIE_DOMAIN is set.
  if (labels.length < 3) return undefined;

  return `.${labels.slice(-2).join(".")}`;
}

const cookieDomain = resolveCookieDomain();

/**
 * Secure cookies unless `NEXTAUTH_URL` explicitly uses `http://`. Defaulting to
 * `true` matters for correctness: `src/middleware.ts` runs on the Edge runtime
 * and only sees env vars that were present at BUILD time. If a shared cookie
 * domain is configured on the server (Node) side but the env var did not reach
 * the Edge bundle, the middleware falls back to Auth.js' own default cookie
 * name — which on HTTPS is `__Secure-authjs.session-token`. Emitting that exact
 * name here keeps the writer (Node) and the reader (Edge middleware) in sync
 * regardless. The `domain` attribute is irrelevant when *reading* a cookie, so
 * a divergence there is harmless.
 */
const useSecureCookies = !(process.env.NEXTAUTH_URL ?? "").startsWith("http://");
const sessionCookieName = `${
  useSecureCookies ? "__Secure-" : ""
}authjs.session-token`;

/**
 * Only emitted when a shared cookie domain is configured. Only `sessionToken`
 * is overridden: it is the one cookie the routing middleware reads on *other*
 * subdomains. `csrfToken` / `callbackUrl` are used only on the host that serves
 * the sign-in POST, so their host-scoped Auth.js defaults are left untouched
 * (and `__Host-` prefixed CSRF cookies cannot carry a `domain` anyway).
 *
 * `__Secure-` (unlike `__Host-`) permits a `domain` attribute, which is exactly
 * what cross-subdomain SSO needs.
 */
const crossSubdomainCookies: NextAuthConfig["cookies"] = cookieDomain
  ? {
      sessionToken: {
        name: sessionCookieName,
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: useSecureCookies,
          domain: cookieDomain,
        },
      },
    }
  : undefined;

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  ...(crossSubdomainCookies ? { cookies: crossSubdomainCookies } : {}),
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = (user as any).isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
