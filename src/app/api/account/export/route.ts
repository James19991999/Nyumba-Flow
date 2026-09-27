import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-helpers";
import {
  findUserById,
  listPropertiesForLandlord,
  listUnitsForProperty,
  listLeasesForLandlord,
  listPaymentsForLandlord,
  listTicketsForLandlord,
  getActiveLeaseForTenant,
  listInvoicesForLease,
  listPaymentsForLease,
} from "@/lib/repo";

/**
 * Kenya Data Protection Act (2019) style self-service data export — a user
 * can download everything NyumbaFlow holds about them as JSON.
 */
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const user = await findUserById(auth.user.id);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const safeUser = {
    id: user.id,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    nationalId: user.nationalId,
    createdAt: user.createdAt,
  };

  if (auth.user.role === "LANDLORD") {
    const properties = await Promise.all(
      (await listPropertiesForLandlord(auth.user.id)).map(async (p) => ({
        ...p,
        units: await listUnitsForProperty(p.id),
      }))
    );
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      profile: safeUser,
      properties,
      leases: await listLeasesForLandlord(auth.user.id),
      payments: await listPaymentsForLandlord(auth.user.id),
      maintenanceTickets: await listTicketsForLandlord(auth.user.id),
    });
  }

  const lease = await getActiveLeaseForTenant(auth.user.id);
  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    profile: safeUser,
    lease: lease ?? null,
    invoices: lease ? await listInvoicesForLease(lease.id) : [],
    payments: lease ? await listPaymentsForLease(lease.id) : [],
  });
}
