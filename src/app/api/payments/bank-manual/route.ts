import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api-helpers";
import {
  createPaymentTransaction,
  getInvoiceById,
  getLeaseById,
  getUnitById,
  getPropertyById,
  settleCompletedPayment,
} from "@/lib/repo";

const schema = z.object({
  invoiceId: z.string(),
  amount: z.number().positive(),
  reference: z.string().optional(),
});

// Bank Transfer / PesaLink / RTGS are not real-time collectible through
// IntaSend the way M-Pesa STK Push and card/Airtel checkout are. Rather than
// faking an automatic success, a landlord who sees the transfer land in
// their bank account confirms it here — this is the "manual reconciliation"
// path called out in the payment channel filter chips.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["LANDLORD"]);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invoice and amount are required");

  const invoice = await getInvoiceById(parsed.data.invoiceId);
  if (!invoice) return jsonError("Invoice not found", 404);
  const lease = await getLeaseById(invoice.leaseId);
  if (!lease) return jsonError("Lease not found", 404);
  const unit = await getUnitById(lease.unitId);
  const property = unit ? await getPropertyById(unit.propertyId) : undefined;
  if (!property || property.landlordId !== auth.user.id) {
    return jsonError("Not authorized", 403);
  }

  const payment = await createPaymentTransaction({
    invoiceId: invoice.id,
    leaseId: lease.id,
    tenantId: lease.tenantId,
    amount: parsed.data.amount,
    channel: "BANK",
  });
  await settleCompletedPayment(payment.id);

  return NextResponse.json({ paymentId: payment.id, status: "COMPLETE" });
}
