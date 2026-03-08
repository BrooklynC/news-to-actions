/**
 * Domain logic for summarizing an article.
 * Throws on failure; used by both server action (wraps with redirect) and job runner.
 */
import { prisma } from "@/lib/db";
import { getAnthropicClient, ANTHROPIC_MODEL } from "@/lib/ai/anthropic";
import { log } from "@/lib/observability/logger";
import { checkAndRecordAiUsage, updateUsageEventTokens } from "@/lib/usage/limits";

export async function executeSummarizeArticle(
  organizationId: string,
  articleId: string
): Promise<void> {
  const article = await prisma.article.findFirst({
    where: { id: articleId, organizationId },
    select: { id: true, title: true, url: true, rssSnippet: true, summary: true },
  });
  if (!article) throw new Error("Article not found");

  const limit = await checkAndRecordAiUsage({
    organizationId,
    userId: null,
    action: "SUMMARIZE",
  });
  if (!limit.ok) throw new Error(limit.message);
  const usageEventId = limit.usageEventId;

  const body = article.rssSnippet ?? article.summary ?? "";
  const content = [article.title, article.url, body]
    .filter(Boolean)
    .join("\n\n");

  let response;
  try {
    response = await getAnthropicClient().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Summarize this article in 3-5 bullet lines. Max ~120 words. Each line starts with "- " and is one sentence. Plain text only, no markdown.\n\n${content}`,
        },
      ],
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status: number }).status === 429
    ) {
      throw new Error("AI quota exceeded. Please check billing.");
    }
    log.error("summarize.ai_error", "AI request failed", {
      organizationId,
      meta: { articleId },
      err: error,
    });
    throw new Error("AI request failed. Check server logs.");
  }

  const firstBlock = response.content[0];
  const raw =
    firstBlock && firstBlock.type === "text" ? firstBlock.text : "";
  if (!raw.trim())
    throw new Error("AI returned an empty response. Try again.");

  if (usageEventId && response.usage) {
    await updateUsageEventTokens(usageEventId, {
      inputTokens: response.usage.input_tokens ?? 0,
      outputTokens: response.usage.output_tokens ?? 0,
      model: ANTHROPIC_MODEL,
    });
  }

  const summary = raw.trim();
  await prisma.article.update({
    where: { id: article.id },
    data: { summary },
  });
}
