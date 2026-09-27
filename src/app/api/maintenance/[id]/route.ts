import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { getTicketById, updateTicket, getPropertyById } from "@/lib/repo";

const schema = z.object({
  status: z.enum(["REPORTED", "ASSIGNED", "QUOTED", "REPAIRED", "PAID"]).optional(),
  contractorName: z.string().optional(),
  contractorPhone: z.string().optional(),
  quoteAmount: z.number().nonnegative().optional(),
  quoteApproved: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(["LANDLORD"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const ticket = await getTicketById(id);
  if (!ticket) return jsonError("Ticket not found", 404);
  const property = await getPropertyById(ticket.propertyId);
  if (!property || property.landlordId !== auth.user.id) {
    return jsonError("Not authorized", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid update");

  const updated = await updateTicket(id, parsed.data);
  return NextResponse.json({ ticket: updated });
}
