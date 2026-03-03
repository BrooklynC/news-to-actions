/**
 * Export storage abstraction for org export artifacts.
 * Local filesystem backend for dev; S3-compatible backend for production.
 * Backend selected via EXPORT_STORAGE_BACKEND env (local_fs | s3).
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { log } from "@/lib/observability/logger";
import { createS3ExportStorage } from "./s3ExportStorage";

export type ExportStorage = {
  putObject(key: string, body: Buffer, contentType: string): Promise<{ key: string; sizeBytes: number }>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
};

const BACKEND_LOCAL = "local_fs";
const BACKEND_S3 = "s3";

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

function getBaseDir(): string {
  const baseDir = process.env.EXPORT_STORAGE_BASE_DIR || ".export-artifacts";
  return path.resolve(process.cwd(), baseDir);
}

async function ensureDirForFile(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

function createLocalExportStorage(): ExportStorage {
  return {
    async putObject(key: string, body: Buffer, contentType: string): Promise<{ key: string; sizeBytes: number }> {
      assertPathSafeKey(key);
      const baseDir = getBaseDir();
      const fullPath = path.join(baseDir, key);
      await ensureDirForFile(fullPath);
      await fs.writeFile(fullPath, body, { flag: "w" });
      const sizeBytes = body.length;
      log.info("export_storage.put", "Export artifact written", {
        meta: { key, sizeBytes, backend: BACKEND_LOCAL },
      });
      return { key, sizeBytes };
    },

    async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
      assertPathSafeKey(key);
      const baseDir = getBaseDir();
      const fullPath = path.resolve(baseDir, key);
      const url = `file://${fullPath}`;
      log.info("export_storage.get_url", "Export signed URL (placeholder)", {
        meta: { key, backend: BACKEND_LOCAL, expiresInSeconds },
      });
      return url;
    },

    async deleteObject(key: string): Promise<void> {
      assertPathSafeKey(key);
      const baseDir = getBaseDir();
      const fullPath = path.join(baseDir, key);
      try {
        await fs.unlink(fullPath);
        log.info("export_storage.delete", "Export artifact removed", {
          meta: { key, backend: BACKEND_LOCAL },
        });
      } catch (e: unknown) {
        const err = e as NodeJS.ErrnoException;
        if (err?.code === "ENOENT") return;
        throw e;
      }
    },
  };
}

function getBackend(): string {
  const v = process.env.EXPORT_STORAGE_BACKEND?.trim().toLowerCase();
  return v === BACKEND_S3 ? BACKEND_S3 : BACKEND_LOCAL;
}

let _instance: ExportStorage | null = null;

function getExportStorage(): ExportStorage {
  if (!_instance) {
    _instance = getBackend() === BACKEND_S3 ? createS3ExportStorage() : createLocalExportStorage();
  }
  return _instance;
}

export const exportStorage: ExportStorage = {
  putObject: (...args) => getExportStorage().putObject(...args),
  getSignedUrl: (...args) => getExportStorage().getSignedUrl(...args),
  deleteObject: (...args) => getExportStorage().deleteObject(...args),
};
