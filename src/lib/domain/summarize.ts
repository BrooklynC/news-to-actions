/**
 * Domain logic for summarizing an article.
 * Throws on failure; used by both server action (wraps with redirect) and job runner.
 */
import { prisma } from "@/lib/db";
import { getOpenAIClient } from "@/lib/openai";
import { log } from "@/lib/observability/logger";
import { checkAndRecordAiUsage, updateUsageEventTokens } from "@/lib/usage/limits";

export async function executeSummarizeArticle(
  organizationId: string,
  articleId: string
): Promise<void> {
  const article = await prisma.article.findFirst({
    where: { id: articleId, organizationId },
    select: { id: true, title: true, url: true, summary: true },
  });
  if (!article) throw new Error("Article not found");

  const limit = await checkAndRecordAiUsage({
    organizationId,
    userId: null,
    action: "SUMMARIZE",
  });
  if (!limit.ok) throw new Error(limit.message);
  const usageEventId = limit.usageEventId;

  const content = [article.title, article.url, article.summary]
    .filter(Boolean)
    .join("\n\n");

  let completion;
  try {
    completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
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
      throw new Error("OpenAI quota exceeded. Please check billing.");
    }
    log.error("summarize.openai_error", "OpenAI request failed", {
      organizationId,
      articleId,
      err: error,
    });
    throw new Error("AI request failed. Check server logs.");
  }

  const raw = completion.choices[0]?.message?.content ?? "";
  if (!raw.trim())
    throw new Error("AI returned an empty response. Try again.");

  if (usageEventId && completion.usage) {
    await updateUsageEventTokens(usageEventId, {
      inputTokens: completion.usage.prompt_tokens ?? 0,
      outputTokens: completion.usage.completion_tokens ?? 0,
      model: completion.model ?? "gpt-4o-mini",
    });
  }

  const summary = raw.trim();
  await prisma.article.update({
    where: { id: article.id },
    data: { summary },
  });
}
