/**
 * IntaSend payment integration.
 *
 * NyumbaFlow uses IntaSend (https://intasend.com) as its ONLY payment
 * processor — Stripe, PayPal, or any other processor must never be added
 * here or anywhere else in this codebase.
 *
 * Two IntaSend products are used:
 *  1. M-Pesa STK Push (Collections API)  -> "Pay with M-Pesa" everywhere in
 *     the UI (tenant portal self-pay, landlord "1-Tap STK Push" arrears
 *     collection, batch STK push from the dashboard).
 *  2. Hosted Checkout (Collections API)  -> Card and Airtel Money payments,
 *     used wherever the design shows "Card" / "Airtel" as a payment rail.
 *     Bank Transfer / PesaLink / RTGS is treated as manual/offline
 *     reconciliation (IntaSend does not do real-time push collection over
 *     bank rails the way it does for M-Pesa/cards), and is recorded by a
 *     landlord manually confirming receipt — never faked as an automatic
 *     success.
 *
 * Docs referenced while building this:
 *  - https://developers.intasend.com/docs/authentication
 *  - https://developers.intasend.com/reference/api_v1_payment_mpesa_stk_push_create
 *  - https://github.com/IntaSend/documentation/blob/master/online-payments/express-checkout.md
 *  - https://developers.intasend.com/docs/payment-collection-events
 */

const IS_LIVE = process.env.INTASEND_ENV === "live";

const API_BASE = IS_LIVE
  ? "https://payment.intasend.com/api/v1"
  : "https://sandbox.intasend.com/api/v1";

const SECRET_KEY = process.env.INTASEND_SECRET_KEY || "";
const PUBLISHABLE_KEY = process.env.INTASEND_PUBLISHABLE_KEY || "";
const WEBHOOK_CHALLENGE = process.env.INTASEND_WEBHOOK_CHALLENGE || "";

function assertConfigured() {
  if (!SECRET_KEY || !PUBLISHABLE_KEY) {
    throw new Error(
      "IntaSend is not configured. Set INTASEND_SECRET_KEY and INTASEND_PUBLISHABLE_KEY in .env (see .env.example). " +
        "Get sandbox keys from your IntaSend dashboard -> Settings -> API Keys."
    );
  }
}

async function intasendFetch(path: string, body: Record<string, unknown>) {
  assertConfigured();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (json && (json.detail || json.message)) ||
      `IntaSend request failed with status ${res.status}`;
    throw new Error(message);
  }
  return json;
}

export interface StkPushResult {
  invoiceId: string;
  state: string;
  raw: unknown;
}

/**
 * Trigger an M-Pesa STK Push (Safaricom PIN prompt) to the given phone
 * number. `apiRef` should be our internal payment_transactions.id so the
 * webhook can be matched back to the right row.
 */
export async function triggerMpesaStkPush(params: {
  phoneNumber: string;
  amount: number;
  apiRef: string;
}): Promise<StkPushResult> {
  const json = await intasendFetch("/payment/mpesa-stk-push/", {
    amount: params.amount.toFixed(2),
    phone_number: normalizeKenyanPhone(params.phoneNumber),
    api_ref: params.apiRef,
  });

  return {
    invoiceId: json.invoice?.invoice_id || json.id || "",
    state: json.invoice?.state || "PENDING",
    raw: json,
  };
}

export interface CheckoutResult {
  checkoutId: string;
  url: string;
  raw: unknown;
}

/**
 * Create a hosted IntaSend checkout session for card or Airtel Money
 * payments. The tenant is redirected to `url` to complete payment; IntaSend
 * redirects back to `redirectUrl` afterwards, and the webhook confirms the
 * final state server-side.
 */
export async function createHostedCheckout(params: {
  amount: number;
  email: string;
  firstName: string;
  lastName: string;
  apiRef: string;
  redirectUrl: string;
  method: "CARD" | "AIRTEL";
}): Promise<CheckoutResult> {
  const json = await intasendFetch("/checkout/", {
    public_key: PUBLISHABLE_KEY,
    amount: params.amount,
    currency: "KES",
    email: params.email,
    first_name: params.firstName,
    last_name: params.lastName,
    country: "KE",
    api_ref: params.apiRef,
    redirect_url: params.redirectUrl,
    method: params.method === "CARD" ? "CARD-PAYMENT" : "MOBILE-MONEY",
  });

  return {
    checkoutId: json.id,
    url: json.url,
    raw: json,
  };
}

export interface IntaSendWebhookPayload {
  invoice_id: string;
  state: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";
  provider: string;
  value: string;
  currency: string;
  api_ref: string | null;
  failed_reason?: string | null;
  challenge?: string;
}

/**
 * Verify an incoming IntaSend webhook by checking the shared "challenge"
 * value configured in the IntaSend dashboard (Settings -> Webhooks) against
 * INTASEND_WEBHOOK_CHALLENGE. This is IntaSend's documented mechanism for
 * confirming a webhook call actually originated from IntaSend.
 */
export function verifyWebhookChallenge(payload: IntaSendWebhookPayload): boolean {
  if (!WEBHOOK_CHALLENGE) {
    // Fail closed: refuse to trust webhooks until a challenge is configured.
    return false;
  }
  return payload.challenge === WEBHOOK_CHALLENGE;
}

/** Normalize 07xx/01xx/+2547xx/2547xx into the 2547xxxxxxxx format IntaSend expects. */
export function normalizeKenyanPhone(input: string): string {
  const digits = input.replace(/[^\d]/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") || digits.startsWith("1")) return `254${digits}`;
  return digits;
}

export const intasendConfigured = Boolean(SECRET_KEY && PUBLISHABLE_KEY);
