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
    if (process.env.NODE_ENV !== "production") {
      console.error("SERVER_ACTION_FAILED", {
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error,
      });
    }
    redirect(`${BANNER_URL}?banner=${encodeURIComponent("An unexpected error occurred. Please try again.")}`);
  }
}
