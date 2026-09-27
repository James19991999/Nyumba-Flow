import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setSessionCookie, signSession } from "@/lib/auth";
import { consumeOtpCode, findUserByPhone } from "@/lib/repo";
import { jsonError } from "@/lib/api-helpers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({ phone: z.string().min(9), code: z.string().length(6) });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Phone and 6-digit code are required");

  const { phone, code } = parsed.data;

  // 10 guesses per 10 minutes per IP+phone — a 6-digit code has 1e6
  // possibilities, so this keeps brute-forcing impractical.
  const limitKey = `otp-verify:${getClientIp(req)}:${phone}`;
  const limited = rateLimit(limitKey, { limit: 10, windowMs: 10 * 60_000 });
  if (!limited.ok) {
    return jsonError(
      `Too many attempts. Try again in ${Math.ceil(limited.retryAfterMs / 60_000)} minute(s).`,
      429
    );
  }
  const ok = await consumeOtpCode(phone, code);
  if (!ok) return jsonError("Invalid or expired code", 401);

  const user = await findUserByPhone(phone);
  if (!user) return jsonError("Account not found", 404);

  const token = signSession(user.id);
  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: user.id, role: user.role, fullName: user.fullName, phone: user.phone },
  });
}
