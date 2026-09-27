import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api-helpers";
import {
  createNotice,
  listNoticesForProperty,
  listNoticesForTenant,
  getPropertyById,
} from "@/lib/repo";

const schema = z.object({
  propertyId: z.string(),
  title: z.string().min(2),
  body: z.string().min(2),
  category: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  if (auth.user.role === "TENANT") {
    return NextResponse.json({ notices: await listNoticesForTenant(auth.user.id) });
  }
  const propertyId = req.nextUrl.searchParams.get("propertyId");
  if (!propertyId) return jsonError("propertyId is required");
  return NextResponse.json({ notices: await listNoticesForProperty(propertyId) });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(["LANDLORD", "CARETAKER"]);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Property, title and body are required");

  if (auth.user.role === "LANDLORD") {
    const property = await getPropertyById(parsed.data.propertyId);
    if (!property || property.landlordId !== auth.user.id) {
      return jsonError("Not authorized", 403);
    }
  }

  const notice = await createNotice({ ...parsed.data, postedBy: auth.user.id });
  return NextResponse.json({ notice });
}
