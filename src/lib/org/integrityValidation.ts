/**
 * Integrity validation for destructive operations.
 * Detects cross-org references, orphans, and fail-safe conditions.
 */
import { prisma } from "@/lib/db";
import { log } from "@/lib/observability/logger";

export type IntegrityIssue = {
  code: "CROSS_ORG_REFERENCE" | "ORPHAN" | "INVALID_REFERENCE";
  model: string;
  field?: string;
  message: string;
  count?: number;
};

export type IntegrityResult = {
  organizationId: string;
  ok: boolean;
  issues: IntegrityIssue[];
  checkedAtIso: string;
};

/**
 * Validates org-scoped data for destructive operations.
 * Detects cross-org references and orphans.
 */
export async function validateOrgIntegrity(
  organizationId: string,
  logger?: ReturnType<typeof log.child>
): Promise<IntegrityResult> {
  const logCtx = logger ?? log.child({ organizationId });
  const checkedAtIso = new Date().toISOString();
  const issues: IntegrityIssue[] = [];

  try {
    // Cross-org: ActionItem.articleId → Article must belong to same org
    const actionItemsWithArticle = await prisma.actionItem.findMany({
      where: { organizationId },
      select: { id: true, articleId: true },
    });
    for (const ai of actionItemsWithArticle) {
      if (!ai.articleId) continue;
      const art = await prisma.article.findFirst({
        where: { id: ai.articleId },
        select: { organizationId: true },
      });
      if (!art) {
        issues.push({
          code: "ORPHAN",
          model: "ActionItem",
          field: "articleId",
          message: `ActionItem ${ai.id} references non-existent Article ${ai.articleId}`,
        });
      } else if (art.organizationId !== organizationId) {
        issues.push({
          code: "CROSS_ORG_REFERENCE",
          model: "ActionItem",
          field: "articleId",
          message: `ActionItem ${ai.id} references Article in different org`,
        });
      }
    }

    // Cross-org: ActionItem.topicId → Topic must belong to same org
    const actionItemsWithTopic = await prisma.actionItem.findMany({
      where: { organizationId },
      select: { id: true, topicId: true },
    });
    for (const ai of actionItemsWithTopic) {
      if (!ai.topicId) continue;
      const topic = await prisma.topic.findFirst({
        where: { id: ai.topicId },
        select: { organizationId: true },
      });
      if (!topic) {
        issues.push({
          code: "ORPHAN",
          model: "ActionItem",
          field: "topicId",
          message: `ActionItem ${ai.id} references non-existent Topic ${ai.topicId}`,
        });
      } else if (topic.organizationId !== organizationId) {
        issues.push({
          code: "CROSS_ORG_REFERENCE",
          model: "ActionItem",
          field: "topicId",
          message: `ActionItem ${ai.id} references Topic in different org`,
        });
      }
    }

    // Cross-org: ActionItem.personaId → Persona must belong to same org
    const actionItemsWithPersona = await prisma.actionItem.findMany({
      where: { organizationId },
      select: { id: true, personaId: true },
    });
    for (const ai of actionItemsWithPersona) {
      if (!ai.personaId) continue;
      const persona = await prisma.persona.findFirst({
        where: { id: ai.personaId },
        select: { organizationId: true },
      });
      if (!persona) {
        issues.push({
          code: "ORPHAN",
          model: "ActionItem",
          field: "personaId",
          message: `ActionItem ${ai.id} references non-existent Persona ${ai.personaId}`,
        });
      } else if (persona.organizationId !== organizationId) {
        issues.push({
          code: "CROSS_ORG_REFERENCE",
          model: "ActionItem",
          field: "personaId",
          message: `ActionItem ${ai.id} references Persona in different org`,
        });
      }
    }

    // Article.topicId → Topic must belong to same org
    const articlesWithTopic = await prisma.article.findMany({
      where: { organizationId },
      select: { id: true, topicId: true },
    });
    for (const art of articlesWithTopic) {
      const topic = await prisma.topic.findFirst({
        where: { id: art.topicId },
        select: { organizationId: true },
      });
      if (!topic) {
        issues.push({
          code: "ORPHAN",
          model: "Article",
          field: "topicId",
          message: `Article ${art.id} references non-existent Topic ${art.topicId}`,
        });
      } else if (topic.organizationId !== organizationId) {
        issues.push({
          code: "CROSS_ORG_REFERENCE",
          model: "Article",
          field: "topicId",
          message: `Article ${art.id} references Topic in different org`,
        });
      }
    }

    const ok = issues.length === 0;
    logCtx.info("integrity.validation.completed", "Integrity validation completed", {
      organizationId,
      meta: { ok, issueCount: issues.length, checkedAtIso },
    });

    return { organizationId, ok, issues, checkedAtIso };
  } catch (e: unknown) {
    logCtx.error("integrity.validation.failed", "Integrity validation failed", {
      organizationId,
      meta: { checkedAtIso },
      err: e,
    });
    throw e;
  }
}
