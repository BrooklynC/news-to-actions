/**
 * Clears articles, action items, background jobs, job runs, personas, topics, and article summaries.
 * Keeps orgs, users, and settings.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [audit, events, items, runs, jobs, articles] = await Promise.all([
    prisma.actionItemAudit.deleteMany(),
    prisma.actionEvent.deleteMany(),
    prisma.actionItem.deleteMany(),
    prisma.backgroundJobRun.deleteMany(),
    prisma.backgroundJob.deleteMany(),
    prisma.article.deleteMany(),
  ]);

  const [orgSelectedPersonas, topicPersonas, personas, topics] = await Promise.all([
    prisma.orgSelectedPersona.deleteMany(),
    prisma.topicPersona.deleteMany(),
    prisma.persona.deleteMany(),
    prisma.topic.deleteMany(),
  ]);

  console.log("Deleted:", {
    actionItemAudits: audit.count,
    actionEvents: events.count,
    actionItems: items.count,
    backgroundJobRuns: runs.count,
    backgroundJobs: jobs.count,
    articles: articles.count,
    orgSelectedPersonas: orgSelectedPersonas.count,
    topicPersonas: topicPersonas.count,
    personas: personas.count,
    topics: topics.count,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
