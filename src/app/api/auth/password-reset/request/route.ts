import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateOtp } from "@/lib/auth";
import { createOtpCode, findUserByPhone } from "@/lib/repo";
import { sendSms } from "@/lib/sms";
import { jsonError } from "@/lib/api-helpers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({ phone: z.string().min(9) });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("A valid phone number is required");

  const { phone } = parsed.data;

  const limited = rateLimit(`pwreset-request:${getClientIp(req)}:${phone}`, {
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (!limited.ok) {
    return jsonError(
      `Too many requests. Try again in ${Math.ceil(limited.retryAfterMs / 60_000)} minute(s).`,
      429
    );
  }

  const user = await findUserByPhone(phone);
  // Always return ok — never reveal whether a phone number has an account,
  // to avoid leaking which numbers are registered users.
  if (user) {
    const code = generateOtp();
    await createOtpCode(phone, code, 10, "PASSWORD_RESET");
    await sendSms(
      phone,
      `${code} is your NyumbaFlow password reset code. Valid for 10 minutes. Ignore if you didn't request this.`
    );
  }

  return NextResponse.json({ ok: true });
}
