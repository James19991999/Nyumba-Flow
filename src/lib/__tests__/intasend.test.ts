import { describe, expect, it } from "vitest";
import { normalizeKenyanPhone, verifyWebhookChallenge } from "../intasend";

describe("normalizeKenyanPhone", () => {
  it("handles 07XX format", () => {
    expect(normalizeKenyanPhone("0712345678")).toBe("254712345678");
  });
  it("handles 7XX format", () => {
    expect(normalizeKenyanPhone("712345678")).toBe("254712345678");
  });
  it("handles +254 format", () => {
    expect(normalizeKenyanPhone("+254712345678")).toBe("254712345678");
  });
  it("handles already-normalized 254 format", () => {
    expect(normalizeKenyanPhone("254712345678")).toBe("254712345678");
  });
  it("strips spaces and dashes", () => {
    expect(normalizeKenyanPhone("0712 345-678")).toBe("254712345678");
  });
});

describe("verifyWebhookChallenge", () => {
  // INTASEND_WEBHOOK_CHALLENGE is read once at module load; this test file
  // doesn't set it, so the module captures "" — exercising the fail-closed
  // default a fresh deployment has before anyone configures a challenge.
  it("rejects when no challenge is configured (fail closed)", () => {
    expect(
      verifyWebhookChallenge({
        invoice_id: "x",
        state: "COMPLETE",
        provider: "MPESA-STK-PUSH",
        value: "1",
        currency: "KES",
        api_ref: "pay_1",
        challenge: "anything",
      })
    ).toBe(false);
  });
});
