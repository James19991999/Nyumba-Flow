import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { getPaymentById, getLeaseById, getUnitById, getPropertyById } from "@/lib/repo";

// Polled by the STK Push modal in the UI to move from "Pending" to
// "Success"/"Failed" once the IntaSend webhook has confirmed the result.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const payment = await getPaymentById(id);
  if (!payment) return jsonError("Payment not found", 404);

  const lease = payment.leaseId ? await getLeaseById(payment.leaseId) : undefined;
  let isOwner = payment.tenantId === auth.user.id;
  if (!isOwner && lease) {
    const unit = await getUnitById(lease.unitId);
    const property = unit ? await getPropertyById(unit.propertyId) : undefined;
    isOwner = property?.landlordId === auth.user.id;
  }

  if (!isOwner) return jsonError("Not authorized", 403);

  return NextResponse.json({ payment });
}
