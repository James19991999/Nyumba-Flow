import { NextResponse, type NextRequest } from "next/server";

/**
 * Origin-check CSRF mitigation.
 *
 * All mutating API routes are called with `fetch(..., { credentials: "same-origin" })`
 * and JSON bodies, which already blocks classic HTML-form CSRF (browsers can't
 * set a JSON content-type on a cross-origin form submission without a CORS
 * preflight, which we don't allow). This proxy adds a second, explicit layer:
 * any state-changing request to /api/** must have an Origin (or Referer)
 * header matching this app's own host, with three exceptions:
 *   - GET/HEAD/OPTIONS (read-only, nothing to forge)
 *   - /api/webhooks/** (called server-to-server by IntaSend, which sends no
 *     browser Origin header at all — those routes are protected instead by
 *     the IntaSend webhook challenge secret)
 *   - /api/cron/** (called server-to-server by an external scheduler —
 *     Vercel Cron, GitHub Actions, cron-job.org — which also sends no
 *     browser Origin header; protected instead by the CRON_SECRET bearer
 *     token, see src/lib/cron-auth.ts)
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const UNAUTHENTICATED_SERVER_TO_SERVER_PREFIXES = ["/api/webhooks/", "/api/cron/"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) return NextResponse.next();
  if (UNAUTHENTICATED_SERVER_TO_SERVER_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (SAFE_METHODS.has(request.method)) return NextResponse.next();

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  const candidate = origin || referer;
  if (!candidate || !host) {
    return NextResponse.json({ error: "Missing Origin header" }, { status: 403 });
  }

  let candidateHost: string;
  try {
    candidateHost = new URL(candidate).host;
  } catch {
    return NextResponse.json({ error: "Invalid Origin header" }, { status: 403 });
  }

  if (candidateHost !== host) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
