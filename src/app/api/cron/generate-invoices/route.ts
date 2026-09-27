import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { runGenerateMonthlyInvoices } from "@/lib/jobs";

// Trigger from an external scheduler, e.g.:
//   curl -X POST https://yourdomain.com/api/cron/generate-invoices \
//        -H "Authorization: Bearer $CRON_SECRET"
// Recommended schedule: daily, early morning (idempotent, so extra runs are harmless).
//
// GET is also handled because Vercel Cron (see vercel.json) always invokes
// with GET, and automatically attaches `Authorization: Bearer $CRON_SECRET`
// when a CRON_SECRET env var is set on the project.
async function handle(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const result = await runGenerateMonthlyInvoices();
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
