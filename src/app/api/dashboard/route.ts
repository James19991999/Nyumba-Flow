import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-helpers";
import { getLandlordDashboardSummary } from "@/lib/repo";

export async function GET() {
  const auth = await requireUser(["LANDLORD"]);
  if ("error" in auth) return auth.error;
  const summary = await getLandlordDashboardSummary(auth.user.id);
  return NextResponse.json({ summary });
}
