import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, setSessionCookie, signSession } from "@/lib/auth";
import { consumeOtpCode, findUserByPhone, updateUserPassword } from "@/lib/repo";
import { jsonError } from "@/lib/api-helpers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  phone: z.string().min(9),
  code: z.string().length(6),
  newPassword: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Phone, code and a new password (6+ chars) are required");

  const { phone, code, newPassword } = parsed.data;

  const limited = rateLimit(`pwreset-confirm:${getClientIp(req)}:${phone}`, {
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (!limited.ok) {
    return jsonError(
      `Too many attempts. Try again in ${Math.ceil(limited.retryAfterMs / 60_000)} minute(s).`,
      429
    );
  }

  const ok = await consumeOtpCode(phone, code, "PASSWORD_RESET");
  if (!ok) return jsonError("Invalid or expired code", 401);

  const user = await findUserByPhone(phone);
  if (!user) return jsonError("Account not found", 404);

  const passwordHash = await hashPassword(newPassword);
  await updateUserPassword(user.id, passwordHash);

  // Log the user straight in after a successful reset.
  const token = signSession(user.id);
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
