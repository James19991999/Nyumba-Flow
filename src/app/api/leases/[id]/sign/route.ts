import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api-helpers";
import {
  getLeaseById,
  signLease,
  createInvoice,
} from "@/lib/repo";

const schema = z.object({
  signatureName: z.string().min(2),
  signatureNationalId: z.string().min(4),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(["TENANT"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const lease = await getLeaseById(id);
  if (!lease || lease.tenantId !== auth.user.id) {
    return jsonError("Lease not found", 404);
  }
  if (lease.status !== "PENDING_SIGNATURE") {
    return jsonError("Lease is not awaiting signature");
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Full legal name and national ID are required");

  const signed = await signLease(id, parsed.data.signatureName, parsed.data.signatureNationalId);

  // Create the move-in invoice (first month rent + deposit + utility fee)
  const moveInTotal =
    signed.monthlyRent + signed.securityDeposit + signed.serviceCharge;
  const invoice = await createInvoice({
    leaseId: id,
    period: "MOVE_IN",
    amountDue: moveInTotal,
    dueDate: signed.moveInDate,
    isMoveInInvoice: true,
  });

  return NextResponse.json({ lease: signed, moveInInvoice: invoice });
}
