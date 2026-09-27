import { NextRequest, NextResponse } from "next/server";

/**
 * Shared auth guard for /api/cron/* endpoints, meant to be hit by an
 * external scheduler (Vercel Cron, GitHub Actions, a plain crontab curl)
 * when CRON_MODE=external. Requires `Authorization: Bearer <CRON_SECRET>`.
 */
export function requireCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 500 }
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
