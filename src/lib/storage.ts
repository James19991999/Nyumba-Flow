import fs from "node:fs";
import path from "node:path";

/**
 * File storage abstraction for maintenance/inspection photo uploads.
 * STORAGE_DRIVER=local (default) writes to public/uploads — zero-config,
 * fine for a single-instance/dev deployment. STORAGE_DRIVER=s3 uploads to
 * an S3-compatible bucket instead — required once you deploy to serverless
 * or multiple instances, since local disk isn't shared/persistent there.
 */

export interface StoredFile {
  url: string;
}

async function saveLocal(fileName: string, buffer: Buffer): Promise<StoredFile> {
  const dir = path.join(process.cwd(), "public", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), buffer);
  return { url: `/uploads/${fileName}` };
}

async function saveS3(fileName: string, buffer: Buffer, contentType: string): Promise<StoredFile> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const publicUrlBase = process.env.S3_PUBLIC_URL_BASE;

  if (!bucket || !region || !accessKeyId || !secretAccessKey || !publicUrlBase) {
    throw new Error(
      "S3 storage is not fully configured. Set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, " +
        "S3_SECRET_ACCESS_KEY and S3_PUBLIC_URL_BASE in .env (see .env.example)."
    );
  }

  const client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  const key = `uploads/${fileName}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return { url: `${publicUrlBase.replace(/\/$/, "")}/${key}` };
}

export async function saveUploadedFile(
  fileName: string,
  buffer: Buffer,
  contentType: string
): Promise<StoredFile> {
  if (process.env.STORAGE_DRIVER === "s3") {
    return saveS3(fileName, buffer, contentType);
  }
  return saveLocal(fileName, buffer);
}
