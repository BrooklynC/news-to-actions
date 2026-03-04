import { log } from "@/lib/observability/logger";
import { redirect } from "next/navigation";

const BANNER_URL = "/app/articles";

function isRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const d = (error as { digest?: string }).digest;
  return typeof d === "string" && d.includes("NEXT_REDIRECT");
}

export async function safeAction<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isRedirectError(error)) throw error;
    log.error("server_action.failed", "Server action failed", {
      err: error instanceof Error ? error : new Error(String(error)),
    });
    redirect(`${BANNER_URL}?banner=${encodeURIComponent("An unexpected error occurred. Please try again.")}`);
  }
}
