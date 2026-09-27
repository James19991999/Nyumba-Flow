import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { createProperty, listPropertiesForLandlord } from "@/lib/repo";

const schema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
});

export async function GET() {
  const auth = await requireUser(["LANDLORD"]);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ properties: await listPropertiesForLandlord(auth.user.id) });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(["LANDLORD"]);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Name and location are required");

  const property = await createProperty({ landlordId: auth.user.id, ...parsed.data });
  return NextResponse.json({ property });
}
