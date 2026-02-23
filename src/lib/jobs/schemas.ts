import { z } from "zod";

export const IngestTopicPayloadSchema = z.object({
  topicId: z.string().min(1),
});

export const SummarizeArticlePayloadSchema = z.object({
  articleId: z.string().min(1),
});

export const GenerateActionsForArticlePayloadSchema = z.object({
  articleId: z.string().min(1),
});

export const NotifyPayloadSchema = z.object({
  organizationId: z.string().min(1),
  actionItemId: z.string().min(1),
  notificationType: z.enum(["ACTION_ASSIGNED"]).optional(),
});

export type IngestTopicPayload = z.infer<typeof IngestTopicPayloadSchema>;
export type SummarizeArticlePayload = z.infer<typeof SummarizeArticlePayloadSchema>;
export type GenerateActionsForArticlePayload = z.infer<
  typeof GenerateActionsForArticlePayloadSchema
>;
export type NotifyPayload = z.infer<typeof NotifyPayloadSchema>;

const payloadSchemas: Record<string, z.ZodSchema> = {
  INGEST_TOPIC: IngestTopicPayloadSchema,
  SUMMARIZE_ARTICLE: SummarizeArticlePayloadSchema,
  GENERATE_ACTIONS_FOR_ARTICLE: GenerateActionsForArticlePayloadSchema,
  NOTIFY: NotifyPayloadSchema,
};

export function parseJobPayload<T>(
  type: string,
  payloadJson: string
): T {
  const schema = payloadSchemas[type];
  if (!schema) {
    throw new Error(`Unknown job type: ${type}`);
  }
  const parsed = JSON.parse(payloadJson) as unknown;
  return schema.parse(parsed) as T;
}
