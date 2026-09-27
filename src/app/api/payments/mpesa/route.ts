import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api-helpers";
import {
  createPaymentTransaction,
  getInvoiceById,
  getLeaseById,
  getUnitById,
  getPropertyById,
  setPaymentIntasendRefs,
  updatePaymentStatus,
} from "@/lib/repo";
import { triggerMpesaStkPush } from "@/lib/intasend";

const schema = z.object({
  invoiceId: z.string(),
  phoneNumber: z.string().min(9),
  amount: z.number().positive().optional(),
});

// Triggers a real M-Pesa STK Push via IntaSend. Used by:
//  - the tenant portal's "Pay with M-Pesa" button (self-pay)
//  - the landlord dashboard's "1-Tap STK Push" arrears action (pushing to a tenant's phone)
export async function POST(req: NextRequest) {
  const auth = await requireUser(["TENANT", "LANDLORD"]);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invoice and phone number are required");

  const invoice = await getInvoiceById(parsed.data.invoiceId);
  if (!invoice) return jsonError("Invoice not found", 404);
  const lease = await getLeaseById(invoice.leaseId);
  if (!lease) return jsonError("Lease not found", 404);

  // Authorization: tenant may only pay their own lease; landlord may only
  // trigger STK pushes for leases within their own portfolio.
  if (auth.user.role === "TENANT" && lease.tenantId !== auth.user.id) {
    return jsonError("Not authorized", 403);
  }
  if (auth.user.role === "LANDLORD") {
    const unit = await getUnitById(lease.unitId);
    const property = unit ? await getPropertyById(unit.propertyId) : undefined;
    if (!property || property.landlordId !== auth.user.id) {
      return jsonError("Not authorized", 403);
    }
  }

  const outstanding = invoice.amountDue - invoice.amountPaid;
  const amount = parsed.data.amount ?? outstanding;
  if (amount <= 0) return jsonError("Invoice is already fully paid");

  const payment = await createPaymentTransaction({
    invoiceId: invoice.id,
    leaseId: lease.id,
    tenantId: lease.tenantId,
    amount,
    channel: "MPESA",
    phoneNumber: parsed.data.phoneNumber,
  });

  try {
    const result = await triggerMpesaStkPush({
      phoneNumber: parsed.data.phoneNumber,
      amount,
      apiRef: payment.id,
    });
    await setPaymentIntasendRefs(payment.id, { intasendInvoiceId: result.invoiceId });
    await updatePaymentStatus(payment.id, "PROCESSING");
  } catch (err) {
    await updatePaymentStatus(
      payment.id,
      "FAILED",
      err instanceof Error ? err.message : "Failed to reach IntaSend"
    );
    return jsonError(
      err instanceof Error
        ? err.message
        : "Could not trigger M-Pesa STK Push via IntaSend",
      502
    );
  }

  return NextResponse.json({ paymentId: payment.id, status: "PROCESSING" });
}
