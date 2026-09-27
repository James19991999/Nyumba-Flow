import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api-helpers";
import {
  getLeaseById,
  getUnitById,
  getPropertyById,
  getInspectionForLease,
  upsertInspection,
} from "@/lib/repo";

const roomSchema = z.object({
  name: z.string(),
  condition: z.string(),
  notes: z.string().optional().default(""),
  photos: z.number().default(0),
});

const schema = z.object({
  kplcMeterReading: z.number().optional(),
  kplcMeterNumber: z.string().optional(),
  waterMeterReading: z.number().optional(),
  waterMeterNumber: z.string().optional(),
  rooms: z.array(roomSchema).optional(),
});

async function authorizeForLease(leaseId: string, userId: string, role: string) {
  const lease = await getLeaseById(leaseId);
  if (!lease) return null;
  if (role === "TENANT") return lease.tenantId === userId ? lease : null;
  const unit = await getUnitById(lease.unitId);
  const property = unit ? await getPropertyById(unit.propertyId) : undefined;
  return property?.landlordId === userId ? lease : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ leaseId: string }> }
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { leaseId } = await params;

  const lease = await authorizeForLease(leaseId, auth.user.id, auth.user.role);
  if (!lease) return jsonError("Not authorized", 403);

  return NextResponse.json({ inspection: (await getInspectionForLease(leaseId)) ?? null });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leaseId: string }> }
) {
  const auth = await requireUser(["LANDLORD", "CARETAKER"]);
  if ("error" in auth) return auth.error;
  const { leaseId } = await params;

  const lease = await authorizeForLease(leaseId, auth.user.id, auth.user.role);
  if (!lease) return jsonError("Not authorized", 403);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid inspection data");

  const inspection = await upsertInspection({ leaseId, ...parsed.data });
  return NextResponse.json({ inspection });
}
