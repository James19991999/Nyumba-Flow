import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setSessionCookie, signSession, verifyPassword } from "@/lib/auth";
import { findUserByEmail, findUserByPhone } from "@/lib/repo";
import { jsonError } from "@/lib/api-helpers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  identifier: z.string().min(3), // email or phone
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Email/phone and password are required");

  const { identifier, password } = parsed.data;

  // 8 attempts per 15 minutes per IP+identifier — slows down credential
  // stuffing/brute force without punishing a user who mistypes once or twice.
  const limitKey = `login:${getClientIp(req)}:${identifier.toLowerCase()}`;
  const limited = rateLimit(limitKey, { limit: 8, windowMs: 15 * 60_000 });
  if (!limited.ok) {
    return jsonError(
      `Too many attempts. Try again in ${Math.ceil(limited.retryAfterMs / 60_000)} minute(s).`,
      429
    );
  }
  const user = identifier.includes("@")
    ? await findUserByEmail(identifier)
    : await findUserByPhone(identifier);

  if (!user) return jsonError("Invalid credentials", 401);

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return jsonError("Invalid credentials", 401);

  const token = signSession(user.id);
  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: user.id, role: user.role, fullName: user.fullName, phone: user.phone },
  });
}
