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

export type IngestTopicPayload = z.infer<typeof IngestTopicPayloadSchema>;
export type SummarizeArticlePayload = z.infer<typeof SummarizeArticlePayloadSchema>;
export type GenerateActionsForArticlePayload = z.infer<
  typeof GenerateActionsForArticlePayloadSchema
>;

const payloadSchemas: Record<string, z.ZodSchema> = {
  INGEST_TOPIC: IngestTopicPayloadSchema,
  SUMMARIZE_ARTICLE: SummarizeArticlePayloadSchema,
  GENERATE_ACTIONS_FOR_ARTICLE: GenerateActionsForArticlePayloadSchema,
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
