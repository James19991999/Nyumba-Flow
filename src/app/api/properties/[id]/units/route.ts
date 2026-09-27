import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api-helpers";
import {
  createUnit,
  getPropertyById,
  listUnitsForProperty,
  getActiveLeaseForUnit,
} from "@/lib/repo";

const schema = z.object({
  label: z.string().min(1),
  bedrooms: z.string().optional(),
  targetRent: z.number().positive(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(["LANDLORD"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const units = await Promise.all(
    (await listUnitsForProperty(id)).map(async (u) => ({
      ...u,
      leaseId: (await getActiveLeaseForUnit(u.id))?.id ?? null,
    }))
  );
  return NextResponse.json({ units });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(["LANDLORD"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const property = await getPropertyById(id);
  if (!property || property.landlordId !== auth.user.id) {
    return jsonError("Property not found", 404);
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Unit label and target rent are required");

  const unit = await createUnit({ propertyId: id, ...parsed.data });
  return NextResponse.json({ unit });
}
