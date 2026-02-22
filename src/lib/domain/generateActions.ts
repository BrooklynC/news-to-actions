/**
 * Domain logic for generating action items from an article.
 * Throws on failure; used by both server action (wraps with redirect) and job runner.
 */
import { ActionItemListSchema } from "@/lib/ai-schemas";
import { prisma } from "@/lib/db";
import { enforceCaps } from "@/lib/guardrails/caps";
import {
  dedupeByNormalizedText,
  normalizeActionText,
} from "@/lib/guardrails/dedupe";
import { openai } from "@/lib/openai";
import { checkAndRecordAiUsage } from "@/lib/usage/limits";

export async function executeGenerateActionsForArticle(
  organizationId: string,
  articleId: string
): Promise<number> {
  const article = await prisma.article.findFirst({
    where: { id: articleId, organizationId },
    select: { id: true, topicId: true, title: true, url: true, summary: true },
  });
  if (!article) throw new Error("Article not found");

  const capArticle = await enforceCaps({
    organizationId,
    articleId: article.id,
    topicId: null,
    intendedNewActionItems: null,
  });
  if (!capArticle.ok) throw new Error(capArticle.message);

  const existingCount = await prisma.actionItem.count({
    where: { articleId: article.id },
  });

  const personas = await prisma.persona.findMany({
    where: { organizationId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (personas.length === 0)
    throw new Error("No personas. Add at least one persona first.");

  const limit = await checkAndRecordAiUsage({
    organizationId,
    userId: null,
    action: "GENERATE_ACTIONS",
  });
  if (!limit.ok) throw new Error(limit.message);

  const personaList = personas.map((p) => `- ${p.id}: ${p.name}`).join("\n");
  let content = `Article: ${article.title}\nURL: ${article.url}${
    article.summary ? `\nSummary: ${article.summary}` : ""
  }`;
  if (content.length > 6000)
    content = content.slice(0, 6000) + "\n[...truncated]";

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `For each persona below, generate 1-2 concrete next steps based on this article.\n\nOutput JSON ONLY. No markdown. No prose.\nFormat: [{"title":"...","description":"...","dueDate":"...","priority":"LOW|MEDIUM|HIGH","sourceUrl":"..."}]\n\nPersonas:\n${personaList}\n\n${content}`,
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
    console.error("OpenAI error:", error);
    throw new Error("AI request failed. Check server logs.");
  }

  const raw = completion.choices[0]?.message?.content ?? "";
  if (!raw.trim())
    throw new Error("AI returned an empty response. Try again.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned invalid JSON.");
  }

  let actions;
  try {
    actions = ActionItemListSchema.parse(parsed);
  } catch {
    throw new Error(
      "AI returned JSON that doesn't match the expected format."
    );
  }

  const personaId = personas[0]?.id;
  if (!personaId) throw new Error("No persona");

  const existingItems = await prisma.actionItem.findMany({
    where: { organizationId, articleId: article.id },
    select: { text: true },
  });
  const existingNormalizedTitles = new Set(
    existingItems.map((ai) =>
      normalizeActionText(ai.text.split(":")[0] ?? ai.text)
    )
  );
  const inMemoryDeduped = dedupeByNormalizedText(actions);
  const notInDb = inMemoryDeduped.filter(
    (item) => !existingNormalizedTitles.has(normalizeActionText(item.title))
  );
  const remainingSlots = Math.max(0, 10 - existingCount);
  const toCreate = notInDb.slice(0, remainingSlots);

  if (toCreate.length === 0) {
    return 0;
  }

  const capOrg = await enforceCaps({
    organizationId,
    topicId: null,
    articleId: null,
    intendedNewActionItems: toCreate.length,
  });
  if (!capOrg.ok) throw new Error(capOrg.message);

  const createData = toCreate.map((item) => {
    const text = [item.title, item.description]
      .filter(Boolean)
      .join(": ");
    return {
      organizationId,
      articleId: article.id,
      topicId: article.topicId,
      personaId,
      text,
      normalizedTitle: normalizeActionText(item.title),
      status: "OPEN" as const,
      ...(item.priority && { priority: item.priority }),
      ...(item.dueDate && { dueDate: item.dueDate }),
    };
  });

  for (const data of createData) {
    try {
      await prisma.actionItem.create({ data });
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code === "P2002"
      ) {
        // Skip duplicate
      } else {
        throw e;
      }
    }
  }
  return toCreate.length;
}
