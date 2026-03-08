"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { executeGenerateActionsForArticle } from "@/lib/domain/generateActions";
import { executeSummarizeArticle } from "@/lib/domain/summarize";
import { prisma } from "@/lib/db";
import { requireOrgAndUser } from "@/lib/auth";
import { safeAction } from "@/lib/server/safeAction";

const ARTICLES = "/app/articles";

const ALLOWED_STATUS = ["OPEN", "DONE", "DISMISSED"] as const;

async function getOrgAndRedirect() {
  const { orgId: clerkOrgId } = await auth();
  if (!clerkOrgId)
    redirect(`${ARTICLES}?error=` + encodeURIComponent("No organization selected."));

  const org = await prisma.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true },
  });
  if (!org)
    redirect(`${ARTICLES}?error=` + encodeURIComponent("No organization selected."));
  return org;
}

export async function summarizeArticle(formData: FormData) {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const articleId = (formData.get("articleId") as string)?.trim() ?? "";
    if (!articleId)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("articleId is required."));

    const article = await prisma.article.findFirst({
      where: { id: articleId, organizationId: org.id },
      select: { id: true },
    });
    if (!article)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("Article not found"));

    try {
      await executeSummarizeArticle(org.id, articleId);
    } catch (e) {
      redirect(
        `${ARTICLES}?banner=` +
          encodeURIComponent(e instanceof Error ? e.message : "An error occurred")
      );
    }
    redirect(ARTICLES);
  });
}

export async function generateActions(formData: FormData) {
  return safeAction(async () => {
    const org = await getOrgAndRedirect();
    const articleId = (formData.get("articleId") as string)?.trim() ?? "";
    if (!articleId)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("articleId is required."));

    const article = await prisma.article.findFirst({
      where: { id: articleId, organizationId: org.id },
      select: { id: true },
    });
    if (!article)
      redirect(`${ARTICLES}?error=` + encodeURIComponent("Article not found"));

    try {
      const created = await executeGenerateActionsForArticle(org.id, articleId);
      if (created === 0) {
        redirect(
          `${ARTICLES}?banner=` +
            encodeURIComponent("No new action items were created (duplicates filtered).")
        );
      }
    } catch (e) {
      redirect(
        `${ARTICLES}?banner=` +
          encodeURIComponent(e instanceof Error ? e.message : "An error occurred")
      );
    }
    redirect(`${ARTICLES}?message=` + encodeURIComponent("Actions created successfully."));
  });
}

/** Updates only action item status; redirects back to articles feed with persona param. */
export async function setActionItemStatus(formData: FormData) {
  let organizationId: string;
  try {
    const auth = await requireOrgAndUser();
    organizationId = auth.organizationId;
  } catch {
    redirect(`${ARTICLES}?error=` + encodeURIComponent("No organization selected."));
  }

  const id = (formData.get("id") ?? formData.get("actionId") ?? "").toString().trim();
  const status = (formData.get("status") as string)?.trim();
  const personaParam = (formData.get("persona") as string)?.trim() || undefined;

  if (!id || !status || !ALLOWED_STATUS.includes(status as (typeof ALLOWED_STATUS)[number]))
    redirect(`${ARTICLES}?error=` + encodeURIComponent("Invalid input."));

  const existing = await prisma.actionItem.findFirst({
    where: { id, organizationId },
    select: { id: true, status: true },
  });
  if (!existing)
    redirect(`${ARTICLES}?error=` + encodeURIComponent("Action item not found."));

  await prisma.actionItem.update({
    where: { id },
    data: { status: status as "OPEN" | "DONE" | "DISMISSED" },
  });

  const q = new URLSearchParams();
  if (personaParam) q.set("persona", personaParam);
  redirect(ARTICLES + (q.toString() ? "?" + q.toString() : ""));
}
