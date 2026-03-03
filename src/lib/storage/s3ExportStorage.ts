/**
 * S3-compatible export storage backend.
 * Supports AWS S3, Cloudflare R2, MinIO via S3 API.
 *
 * DEPENDENCY-TODO: @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner
 * are required for production export artifact storage with real signed URLs.
 * Local filesystem backend is used when EXPORT_STORAGE_BACKEND != "s3".
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { log } from "@/lib/observability/logger";

const BACKEND = "s3";

export type ExportStorage = {
  putObject(key: string, body: Buffer, contentType: string): Promise<{ key: string; sizeBytes: number }>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
};

function assertPathSafeKey(key: string): void {
  if (key.includes("..")) {
    throw new Error(`ExportStorage: key must not contain ".." (got: ${key})`);
  }
  if (key.startsWith("/") || key.startsWith("\\")) {
    throw new Error(`ExportStorage: key must not start with / or \\ (got: ${key})`);
  }
  if (key.trim() === "") {
    throw new Error("ExportStorage: key must not be empty");
  }
}

function getS3Config(): {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle?: boolean;
} {
  const bucket = process.env.EXPORT_S3_BUCKET?.trim();
  const region = process.env.EXPORT_S3_REGION?.trim() || process.env.AWS_REGION?.trim() || "us-east-1";
  const endpoint = process.env.EXPORT_S3_ENDPOINT?.trim() || undefined;
  const forcePathStyle = process.env.EXPORT_S3_FORCE_PATH_STYLE === "1" || process.env.EXPORT_S3_FORCE_PATH_STYLE === "true";

  if (!bucket) {
    throw new Error("ExportStorage S3: EXPORT_S3_BUCKET is required when EXPORT_STORAGE_BACKEND=s3");
  }

  return { bucket, region, endpoint, forcePathStyle };
}

function createS3Client(): S3Client {
  const { region, endpoint, forcePathStyle } = getS3Config();
  return new S3Client({
    region,
    ...(endpoint && { endpoint }),
    ...(forcePathStyle !== undefined && { forcePathStyle }),
  });
}

export function createS3ExportStorage(): ExportStorage {
  const client = createS3Client();
  const { bucket } = getS3Config();

  return {
    async putObject(key: string, body: Buffer, contentType: string): Promise<{ key: string; sizeBytes: number }> {
      assertPathSafeKey(key);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        })
      );
      const sizeBytes = body.length;
      log.info("export_storage.put", "Export artifact written to S3", {
        meta: { key, sizeBytes, backend: BACKEND, bucket },
      });
      return { key, sizeBytes };
    },

    async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
      assertPathSafeKey(key);
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
      log.info("export_storage.get_url", "Export signed URL generated", {
        meta: { key, backend: BACKEND, expiresInSeconds },
      });
      return url;
    },

    async deleteObject(key: string): Promise<void> {
      assertPathSafeKey(key);
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        log.info("export_storage.delete", "Export artifact removed from S3", {
          meta: { key, backend: BACKEND },
        });
      } catch (e: unknown) {
        const err = e as { name?: string; Code?: string };
        if (err?.name === "NoSuchKey" || err?.Code === "NoSuchKey") return;
        throw e;
      }
    },
  };
}
