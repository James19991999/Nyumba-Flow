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

  // 5 OTP requests per 10 minutes per phone — an SMS gateway costs real money
  // per message, so this also protects against SMS-bombing abuse.
  const limited = rateLimit(`otp-request:${phone}`, { limit: 5, windowMs: 10 * 60_000 });
  if (!limited.ok) {
    return jsonError(
      `Too many OTP requests. Try again in ${Math.ceil(limited.retryAfterMs / 60_000)} minute(s).`,
      429
    );
  }
  const user = await findUserByPhone(phone);
  if (!user) {
    return jsonError(
      "No NyumbaFlow account found for this number. Please register first.",
      404
    );
  }

  const code = generateOtp();
  await createOtpCode(phone, code);
  await sendSms(
    phone,
    `${code} is your NyumbaFlow login code. Tutakutumia nambari ya siri. Valid for 5 minutes.`
  );

  return NextResponse.json({ ok: true });
}
