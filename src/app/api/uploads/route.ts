import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api-helpers";
import { newId } from "@/lib/ids";
import { saveUploadedFile } from "@/lib/storage";

// Storage backend is chosen by STORAGE_DRIVER (local disk or S3) — see
// src/lib/storage.ts. Callers here don't need to know or care which one is active.
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return jsonError("No file uploaded");
  }
  if (!file.type.startsWith("image/")) {
    return jsonError("Only image uploads are allowed");
  }
  if (file.size > 8 * 1024 * 1024) {
    return jsonError("Image must be under 8MB");
  }

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${newId("img")}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const stored = await saveUploadedFile(fileName, buffer, file.type);
    return NextResponse.json({ url: stored.url });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Upload failed", 502);
  }
}
