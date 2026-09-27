import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api-helpers";
import {
  createPaymentTransaction,
  getInvoiceById,
  getLeaseById,
  findUserById,
  setPaymentIntasendRefs,
  updatePaymentStatus,
} from "@/lib/repo";
import { createHostedCheckout } from "@/lib/intasend";

const schema = z.object({
  invoiceId: z.string(),
  method: z.enum(["CARD", "AIRTEL"]),
  amount: z.number().positive().optional(),
});

// Card and Airtel Money payments go through IntaSend's hosted Checkout — the
// tenant is redirected to IntaSend to complete payment, then bounced back
// here. Final confirmation always comes from the IntaSend webhook, never
// from the redirect alone.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["TENANT"]);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invoice and payment method are required");

  const invoice = await getInvoiceById(parsed.data.invoiceId);
  if (!invoice) return jsonError("Invoice not found", 404);
  const lease = await getLeaseById(invoice.leaseId);
  if (!lease || lease.tenantId !== auth.user.id) {
    return jsonError("Not authorized", 403);
  }

  const tenant = (await findUserById(auth.user.id))!;
  const outstanding = invoice.amountDue - invoice.amountPaid;
  const amount = parsed.data.amount ?? outstanding;
  if (amount <= 0) return jsonError("Invoice is already fully paid");

  const payment = await createPaymentTransaction({
    invoiceId: invoice.id,
    leaseId: lease.id,
    tenantId: lease.tenantId,
    amount,
    channel: parsed.data.method,
  });

  const [firstName, ...rest] = tenant.fullName.split(" ");
  const origin = req.headers.get("origin") || req.nextUrl.origin;

  try {
    const result = await createHostedCheckout({
      amount,
      email: tenant.email || `${tenant.phone}@nyumbaflow.local`,
      firstName: firstName || tenant.fullName,
      lastName: rest.join(" ") || "Tenant",
      apiRef: payment.id,
      redirectUrl: `${origin}/tenant?payment=${payment.id}`,
      method: parsed.data.method,
    });
    await setPaymentIntasendRefs(payment.id, { intasendCheckoutId: result.checkoutId });
    await updatePaymentStatus(payment.id, "PROCESSING");
    return NextResponse.json({ paymentId: payment.id, checkoutUrl: result.url });
  } catch (err) {
    await updatePaymentStatus(
      payment.id,
      "FAILED",
      err instanceof Error ? err.message : "Failed to reach IntaSend"
    );
    return jsonError(
      err instanceof Error ? err.message : "Could not create IntaSend checkout",
      502
    );
  }
}
