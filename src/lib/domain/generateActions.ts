/**
 * Domain logic for generating action items from an article.
 * Generates for each selected persona on the article's topic (one AI call per persona).
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
import { getAnthropicClient, ANTHROPIC_MODEL } from "@/lib/ai/anthropic";
import { log } from "@/lib/observability/logger";
import { checkAndRecordAiUsage, updateUsageEventTokens } from "@/lib/usage/limits";


function getRecipeGuidance(recipeType: RecipeType | null): string {
  const r = recipeType ?? "EXEC_BRIEF";
  switch (r) {
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
      rssSnippet: true,
      summary: true,
    },
  });
  if (!article) throw new Error("Article not found");

  // Use raw query to avoid Prisma client sync issues with actionItemsPerPersonaPerArticle
  const rows = await prisma.$queryRaw<[{ action_items_per_persona_per_article: number }]>`
    SELECT "actionItemsPerPersonaPerArticle" as action_items_per_persona_per_article
    FROM "Organization" WHERE id = ${organizationId} LIMIT 1
  `;
  const maxPerPersonaPerArticle = rows[0]?.action_items_per_persona_per_article ?? 2;

  const capArticle = await enforceCaps({
    organizationId,
    articleId: article.id,
    topicId: null,
    intendedNewActionItems: null,
  });
  if (!capArticle.ok) throw new Error(capArticle.message);

  const existingItems = await prisma.actionItem.findMany({
    where: { organizationId, articleId: article.id },
    select: { text: true, personaId: true },
  });
  const existingNormalizedTitles = new Set(
    existingItems.map((ai) =>
      normalizeActionText(ai.text.split(":")[0] ?? ai.text)
    )
  );
  const existingCountByPersona = new Map<string, number>();
  for (const ai of existingItems) {
    const id = ai.personaId ?? "none";
    existingCountByPersona.set(id, (existingCountByPersona.get(id) ?? 0) + 1);
  }
  let totalCreated = 0;
  const seenNormalized = new Set(existingNormalizedTitles);

  const orgSelected = await prisma.orgSelectedPersona.findMany({
    where: { organizationId },
    include: {
      persona: {
        select: { id: true, name: true, recipeType: true },
      },
    },
  });

  let personasToUse: { id: string; name: string; recipeType: RecipeType | null }[];
  if (orgSelected.length > 0) {
    personasToUse = orgSelected.map((o) => ({
      id: o.persona.id,
      name: o.persona.name,
      recipeType: o.persona.recipeType,
    }));
  } else {
    const allPersonas = await prisma.persona.findMany({
      where: { organizationId },
      select: { id: true, name: true, recipeType: true },
      orderBy: { name: "asc" },
    });
    if (allPersonas.length === 0)
      throw new Error("No personas. Add at least one persona first.");
    personasToUse = allPersonas.map((p) => ({
      id: p.id,
      name: p.name,
      recipeType: p.recipeType,
    }));
  }

  const body = article.summary ?? article.rssSnippet ?? "";
  let content = `Article: ${article.title}\nURL: ${article.url}${
    body ? `\nSummary: ${body}` : ""
  }`;
  if (content.length > 6000)
    content = content.slice(0, 6000) + "\n[...truncated]";

  const TACTICAL_PROMPT_RULES = `Each item must be tactical and completable: someone must be able to definitively say "done" when finished. Vague items like "Stay updated", "Evaluate", "Monitor", or "Review" are NOT allowed. Be specific and actionable.`;

  for (const persona of personasToUse) {
    const existingForPersona = existingCountByPersona.get(persona.id) ?? 0;
    const remainingSlots = Math.max(0, maxPerPersonaPerArticle - existingForPersona);
    if (remainingSlots <= 0) continue;

    const limit = await checkAndRecordAiUsage({
      organizationId,
      userId: null,
      action: "GENERATE_ACTIONS",
    });
    if (!limit.ok) throw new Error(limit.message);
    const usageEventId = limit.usageEventId;

    const recipeGuidance = getRecipeGuidance(persona.recipeType);

    let response;
    try {
      response = await getAnthropicClient().messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Generate up to ${remainingSlots} tactical, completable next steps for the persona "${persona.name}" based on this article. Output exactly ${remainingSlots} items or fewer.\n\nFocus: ${recipeGuidance}\n\n${TACTICAL_PROMPT_RULES}\n\nOutput JSON ONLY. No markdown. No prose.\nFormat: [{"title":"...","description":"...","dueDate":"...","priority":"LOW|MEDIUM|HIGH","sourceUrl":"..."}]\n\nRules: title <= 60 chars, 1 line, start with a verb when possible. No trailing punctuation. Each action must be specific, doable, and completable (not vague).\n\n${content}`,
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
      log.error("generate_actions.ai_error", "AI request failed", {
        organizationId,
        meta: { articleId, personaId: persona.id },
        err: error,
      });
      throw new Error("AI request failed. Check server logs.");
    }

    const firstBlock = response.content[0];
    const raw =
      firstBlock && firstBlock.type === "text" ? firstBlock.text : "";
    if (usageEventId && response.usage) {
      await updateUsageEventTokens(usageEventId, {
        inputTokens: response.usage.input_tokens ?? 0,
        outputTokens: response.usage.output_tokens ?? 0,
        model: ANTHROPIC_MODEL,
      });
    }

    if (!raw.trim()) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    let actions;
    try {
      actions = ActionItemListSchema.parse(parsed);
    } catch {
      continue;
    }

    const inMemoryDeduped = dedupeByNormalizedText(actions);
    const toCreate: (typeof inMemoryDeduped)[0][] = [];
    for (const item of inMemoryDeduped) {
      if (toCreate.length >= remainingSlots) break;
      const key = normalizeActionText(normalizeActionTitle(item.title));
      if (seenNormalized.has(key)) continue;
      seenNormalized.add(key);
      toCreate.push(item);
    }

    if (toCreate.length === 0) continue;

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
        personaId: persona.id,
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
        totalCreated++;
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
  }

  return totalCreated;
}
