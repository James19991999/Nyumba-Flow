import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  hashPassword,
  setSessionCookie,
  signSession,
} from "@/lib/auth";
import { createUser, findUserByPhone, findUserByEmail } from "@/lib/repo";
import { jsonError } from "@/lib/api-helpers";

const schema = z.object({
  role: z.enum(["LANDLORD", "TENANT"]),
  fullName: z.string().min(2),
  phone: z.string().min(9),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(6),
  nationalId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { role, fullName, phone, email, password, nationalId } = parsed.data;

  if (await findUserByPhone(phone)) {
    return jsonError("An account with this phone number already exists");
  }
  if (email && (await findUserByEmail(email))) {
    return jsonError("An account with this email already exists");
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({
    role,
    fullName,
    phone,
    email: email || null,
    passwordHash,
    nationalId,
  });

  const token = signSession(user.id);
  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: user.id, role: user.role, fullName: user.fullName, phone: user.phone },
  });
}
