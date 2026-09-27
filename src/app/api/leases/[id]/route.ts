import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api-helpers";
import {
  getLeaseById,
  getUnitById,
  getPropertyById,
  getOrCreateCurrentInvoice,
  listInvoicesForLease,
  getInspectionForLease,
} from "@/lib/repo";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const lease = await getLeaseById(id);
  if (!lease) return jsonError("Lease not found", 404);

  const unit = await getUnitById(lease.unitId);
  const property = unit ? await getPropertyById(unit.propertyId) : undefined;

  const isOwner =
    lease.tenantId === auth.user.id ||
    (property && property.landlordId === auth.user.id);
  if (!isOwner) return jsonError("Not authorized", 403);

  const invoices = await listInvoicesForLease(id);
  const inspection = await getInspectionForLease(id);
  const currentInvoice =
    lease.status === "ACTIVE" ? await getOrCreateCurrentInvoice(lease) : null;

  return NextResponse.json({
    lease,
    unit,
    property,
    invoices,
    currentInvoice,
    inspection,
  });
}
