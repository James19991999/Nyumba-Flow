import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api-helpers";
import {
  getActiveLeaseForTenant,
  getOrCreateCurrentInvoice,
  getUnitById,
  getPropertyById,
  listPaymentsForLease,
  listNoticesForTenant,
  listTicketsForProperty,
} from "@/lib/repo";

export async function GET() {
  const auth = await requireUser(["TENANT"]);
  if ("error" in auth) return auth.error;

  const lease = await getActiveLeaseForTenant(auth.user.id);
  if (!lease) {
    return NextResponse.json({ lease: null });
  }

  const unit = await getUnitById(lease.unitId);
  const property = unit ? await getPropertyById(unit.propertyId) : undefined;
  const invoice =
    lease.status === "ACTIVE" ? await getOrCreateCurrentInvoice(lease) : null;
  const payments = await listPaymentsForLease(lease.id);
  const notices = await listNoticesForTenant(auth.user.id);
  const tickets = property
    ? (await listTicketsForProperty(property.id)).filter(
        (t) => t.reportedBy === auth.user.id || t.unitId === lease.unitId
      )
    : [];

  return NextResponse.json({
    lease,
    unit,
    property,
    invoice,
    payments,
    notices,
    tickets,
  });
}
