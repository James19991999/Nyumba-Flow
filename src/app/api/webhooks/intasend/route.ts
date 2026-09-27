import { NextRequest, NextResponse } from "next/server";
import {
  IntaSendWebhookPayload,
  verifyWebhookChallenge,
} from "@/lib/intasend";
import {
  getPaymentById,
  updatePaymentStatus,
  settleCompletedPayment,
} from "@/lib/repo";

/**
 * IntaSend webhook receiver.
 *
 * Configure this URL in your IntaSend dashboard under Settings -> Webhooks
 * (e.g. https://yourdomain.com/api/webhooks/intasend), and set the same
 * "challenge" string in both the dashboard and INTASEND_WEBHOOK_CHALLENGE.
 *
 * This is the ONLY place a payment is ever marked COMPLETE for M-Pesa STK
 * Push and hosted checkout (card/Airtel) transactions — the client-side
 * redirect or poll never marks a payment successful on its own, since that
 * state can be spoofed or interrupted.
 */
export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as IntaSendWebhookPayload | null;
  if (!payload || !payload.api_ref) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!verifyWebhookChallenge(payload)) {
    return NextResponse.json({ error: "Invalid webhook challenge" }, { status: 401 });
  }

  const payment = await getPaymentById(payload.api_ref);
  if (!payment) {
    // Unknown api_ref — acknowledge with 200 so IntaSend doesn't retry forever,
    // but do nothing since we have no matching transaction.
    return NextResponse.json({ ok: true, note: "No matching transaction" });
  }

  const rawJson = JSON.stringify(payload);

  switch (payload.state) {
    case "COMPLETE":
      await settleCompletedPayment(payment.id);
      await updatePaymentStatus(payment.id, "COMPLETE", null, rawJson);
      break;
    case "FAILED":
      await updatePaymentStatus(payment.id, "FAILED", payload.failed_reason ?? "Payment failed", rawJson);
      break;
    case "PROCESSING":
      await updatePaymentStatus(payment.id, "PROCESSING", null, rawJson);
      break;
    default:
      await updatePaymentStatus(payment.id, "PENDING", null, rawJson);
  }

  return NextResponse.json({ ok: true });
}
