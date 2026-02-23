/**
 * Domain logic for generating action items from an article.
 * Throws on failure; used by both server action (wraps with redirect) and job runner.
 */
import type { RecipeType } from "@prisma/client";
import { ActionItemListSchema } from "@/lib/ai-schemas";
import { prisma } from "@/lib/db";
import { enforceCaps } from "@/lib/guardrails/caps";
import {
  dedupeByNormalizedText,
  normalizeActionText,
} from "@/lib/guardrails/dedupe";
import { normalizeActionTitle } from "./normalizeActionTitle";
import { getOpenAIClient } from "@/lib/openai";
import { checkAndRecordAiUsage } from "@/lib/usage/limits";

function getRecipeGuidance(recipeType: RecipeType): string {
  switch (recipeType) {
    case "EXEC_BRIEF":
      return "Focus on what happened, why it matters, decisions/risks.";
    case "MARKETING_ANGLES":
      return "Focus on positioning, messaging hooks, campaign ideas, audience angles.";
    case "COMPLIANCE_FLAGS":
      return "Focus on regulatory, operational risk, policy updates, watch items (flags only, no legal advice).";
    case "SALES_PROSPECTING":
      return "Focus on outreach angles, questions to ask, triggers, account planning ideas.";
    case "PRODUCT_SIGNALS":
      return "Focus on roadmap implications, competitor moves, feature gaps, integration ideas.";
    default:
      return "Focus on what happened, why it matters, decisions/risks.";
  }
}

export async function executeGenerateActionsForArticle(
  organizationId: string,
  articleId: string
): Promise<number> {
  const article = await prisma.article.findFirst({
    where: { id: articleId, organizationId },
    select: {
      id: true,
      topicId: true,
      title: true,
      url: true,
      summary: true,
      topic: { select: { recipeType: true } },
    },
  });
  if (!article) throw new Error("Article not found");

  const recipeType = article.topic?.recipeType ?? "EXEC_BRIEF";

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

  const recipeGuidance = getRecipeGuidance(recipeType);

  let completion;
  try {
    completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `For each persona below, generate 3–7 concrete next steps based on this article.\n\nRecipe focus: ${recipeGuidance}\n\nOutput JSON ONLY. No markdown. No prose.\nFormat: [{"title":"...","description":"...","dueDate":"...","priority":"LOW|MEDIUM|HIGH","sourceUrl":"..."}]\n\nRules: title <= 60 chars, 1 line, start with a verb when possible. No trailing punctuation. Each action specific and doable.\n\nPersonas:\n${personaList}\n\n${content}`,
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
    (item) =>
      !existingNormalizedTitles.has(
        normalizeActionText(normalizeActionTitle(item.title))
      )
  );
  const remainingSlots = Math.max(0, 10 - existingCount);
  const seenNormalized = new Set(existingNormalizedTitles);
  const toCreate: (typeof inMemoryDeduped)[0][] = [];
  for (const item of notInDb) {
    if (toCreate.length >= remainingSlots) break;
    const key = normalizeActionText(normalizeActionTitle(item.title));
    if (seenNormalized.has(key)) continue;
    seenNormalized.add(key);
    toCreate.push(item);
  }

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
    const title = normalizeActionTitle(item.title);
    const text = [title, item.description]
      .filter(Boolean)
      .join(": ");
    return {
      organizationId,
      articleId: article.id,
      topicId: article.topicId,
      personaId,
      text,
      normalizedTitle: normalizeActionText(title),
      status: "OPEN" as const,
      ...(item.priority && { priority: item.priority }),
      ...(item.dueDate && { dueDate: item.dueDate }),
    };
  });

  for (const data of createData) {
    try {
      await prisma.$transaction(async (tx) => {
        const created = await tx.actionItem.create({ data });
        await tx.actionEvent.create({
          data: {
            organizationId,
            actionId: created.id,
            eventType: "CREATED",
            actorUserId: null,
            metadata: { source: "ai" },
          },
        });
      });
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
