import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api-helpers";
import {
  getLeaseById,
  getUnitById,
  getPropertyById,
  completeInspectionSignOff,
} from "@/lib/repo";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ leaseId: string }> }
) {
  const auth = await requireUser(["TENANT", "LANDLORD", "CARETAKER"]);
  if ("error" in auth) return auth.error;
  const { leaseId } = await params;

  const lease = await getLeaseById(leaseId);
  if (!lease) return jsonError("Lease not found", 404);

  let who: "TENANT" | "CARETAKER";
  if (auth.user.role === "TENANT") {
    if (lease.tenantId !== auth.user.id) return jsonError("Not authorized", 403);
    who = "TENANT";
  } else {
    const unit = await getUnitById(lease.unitId);
    const property = unit ? await getPropertyById(unit.propertyId) : undefined;
    if (auth.user.role === "LANDLORD" && property?.landlordId !== auth.user.id) {
      return jsonError("Not authorized", 403);
    }
    who = "CARETAKER";
  }

  const inspection = await completeInspectionSignOff(leaseId, who);
  return NextResponse.json({ inspection });
}
