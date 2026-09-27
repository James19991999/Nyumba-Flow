import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api-helpers";
import {
  createTicket,
  getActiveLeaseForTenant,
  getUnitById,
  listTicketsForLandlord,
  listTicketsForProperty,
} from "@/lib/repo";

const schema = z.object({
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  category: z.enum(["PLUMBING", "ELECTRICAL", "CARPENTRY", "OTHER"]),
  title: z.string().min(2),
  notes: z.string().optional(),
  priority: z.enum(["URGENT", "NORMAL"]).optional(),
  photoUrls: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  if (auth.user.role === "LANDLORD") {
    return NextResponse.json({ tickets: await listTicketsForLandlord(auth.user.id) });
  }

  const propertyId = req.nextUrl.searchParams.get("propertyId");
  if (propertyId) {
    return NextResponse.json({ tickets: await listTicketsForProperty(propertyId) });
  }
  return NextResponse.json({ tickets: [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Category and title are required");

  let propertyId = parsed.data.propertyId;
  let unitId = parsed.data.unitId;

  if (auth.user.role === "TENANT" && !propertyId) {
    const lease = await getActiveLeaseForTenant(auth.user.id);
    if (!lease) return jsonError("No active lease found for this tenant");
    const unit = await getUnitById(lease.unitId);
    if (!unit) return jsonError("Unit not found", 404);
    propertyId = unit.propertyId;
    unitId = unit.id;
  }

  if (!propertyId) return jsonError("propertyId is required");

  const ticket = await createTicket({
    propertyId,
    unitId,
    reportedBy: auth.user.id,
    category: parsed.data.category,
    title: parsed.data.title,
    notes: parsed.data.notes,
    priority: parsed.data.priority,
    photoUrls: parsed.data.photoUrls,
  });

  return NextResponse.json({ ticket });
}
