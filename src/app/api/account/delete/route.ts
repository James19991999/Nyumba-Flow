import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-helpers";
import { clearSessionCookie } from "@/lib/auth";
import { deleteUserAccount } from "@/lib/repo";

/**
 * Account deletion request. Anonymizes personally identifying information
 * (see deleteUserAccount in src/lib/repo.ts for why we anonymize rather than
 * hard-delete — financial/lease records tied to an ongoing tenancy need to
 * stay intact for the other party and for audit purposes).
 */
export async function POST() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  await deleteUserAccount(auth.user.id);
  await clearSessionCookie();

  return NextResponse.json({ ok: true });
}
