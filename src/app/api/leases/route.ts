import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api-helpers";
import {
  createLease,
  getUnitById,
  getPropertyById,
  findUserByPhone,
  createUser,
  listLeasesForLandlord,
} from "@/lib/repo";
import { hashPassword } from "@/lib/auth";

const schema = z.object({
  unitId: z.string(),
  tenantFullName: z.string().min(2),
  tenantPhone: z.string().min(9),
  monthlyRent: z.number().positive(),
  securityDeposit: z.number().nonnegative(),
  serviceCharge: z.number().nonnegative().default(0),
  moveInDate: z.string(),
  leaseTermMonths: z.number().int().positive().default(12),
  rentDueDay: z.number().int().min(1).max(28).default(5),
  lateFeePerDay: z.number().nonnegative().default(0),
});

export async function GET() {
  const auth = await requireUser(["LANDLORD"]);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ leases: await listLeasesForLandlord(auth.user.id) });
}

// Landlord creates a lease for a (possibly new) tenant. If the tenant phone
// number has no account yet, a TENANT account is created with a random
// temporary password they can reset via OTP login.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["LANDLORD"]);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");

  const unit = await getUnitById(parsed.data.unitId);
  if (!unit) return jsonError("Unit not found", 404);
  const property = await getPropertyById(unit.propertyId);
  if (!property || property.landlordId !== auth.user.id) {
    return jsonError("Unit not found", 404);
  }

  let tenant = await findUserByPhone(parsed.data.tenantPhone);
  if (!tenant) {
    const tempPassword = Math.random().toString(36).slice(2, 10);
    const passwordHash = await hashPassword(tempPassword);
    tenant = await createUser({
      role: "TENANT",
      fullName: parsed.data.tenantFullName,
      phone: parsed.data.tenantPhone,
      passwordHash,
    });
  }

  const lease = await createLease({
    unitId: parsed.data.unitId,
    tenantId: tenant.id,
    monthlyRent: parsed.data.monthlyRent,
    securityDeposit: parsed.data.securityDeposit,
    serviceCharge: parsed.data.serviceCharge,
    moveInDate: parsed.data.moveInDate,
    leaseTermMonths: parsed.data.leaseTermMonths,
    rentDueDay: parsed.data.rentDueDay,
    lateFeePerDay: parsed.data.lateFeePerDay,
  });

  return NextResponse.json({ lease, tenant: { id: tenant.id, phone: tenant.phone } });
}
