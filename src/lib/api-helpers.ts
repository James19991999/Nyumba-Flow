import { NextResponse } from "next/server";
import { getCurrentUser, Role, SessionUser } from "./auth";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireUser(
  allowedRoles?: Role[]
): Promise<{ user: SessionUser } | { error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: jsonError("Not authenticated", 401) };
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { error: jsonError("Not authorized", 403) };
  }
  return { user };
}
