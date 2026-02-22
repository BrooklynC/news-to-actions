import { prisma } from "@/lib/db";

export type CapCheck =
  | { ok: true }
  | {
      ok: false;
      code:
        | "MAX_ACTIONS_PER_ARTICLE"
        | "MAX_ARTICLES_PER_TOPIC_DAY"
        | "MAX_NEW_ACTIONS_PER_ORG_DAY";
      message: string;
    };

function startOfTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

export async function enforceCaps(params: {
  organizationId: string;
  topicId?: string | null;
  articleId?: string | null;
  intendedNewActionItems?: number | null;
}): Promise<CapCheck> {
  const { organizationId, topicId, articleId, intendedNewActionItems } = params;
  const dayStart = startOfTodayLocal();

  if (articleId != null) {
    const existing = await prisma.actionItem.count({
      where: {
        organizationId,
        articleId,
      },
    });
    if (existing >= 10) {
      return {
        ok: false,
        code: "MAX_ACTIONS_PER_ARTICLE",
        message: "This article already has the maximum of 10 action items.",
      };
    }
  }

  if (topicId != null) {
    const articlesToday = await prisma.article.count({
      where: {
        organizationId,
        topicId,
        createdAt: { gte: dayStart },
      },
    });
    if (articlesToday >= 50) {
      return {
        ok: false,
        code: "MAX_ARTICLES_PER_TOPIC_DAY",
        message:
          "Daily cap reached: maximum 50 articles ingested per topic per day.",
      };
    }
  }

  if (intendedNewActionItems != null && intendedNewActionItems > 0) {
    const countToday = await prisma.actionItem.count({
      where: {
        organizationId,
        createdAt: { gte: dayStart },
      },
    });
    if (countToday + intendedNewActionItems > 50) {
      return {
        ok: false,
        code: "MAX_NEW_ACTIONS_PER_ORG_DAY",
        message:
          "Daily cap reached: maximum 50 new action items created per org per day.",
      };
    }
  }

  return { ok: true };
}
