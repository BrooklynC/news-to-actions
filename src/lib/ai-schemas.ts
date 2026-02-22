import { z } from "zod";

export const ActionPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const ActionItemSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: ActionPrioritySchema.optional(),
  sourceUrl: z.string().url().optional(),
});

export const ActionItemListSchema = z.array(ActionItemSchema);

export type ActionItemInput = z.infer<typeof ActionItemSchema>;
export type ActionItemListInput = z.infer<typeof ActionItemListSchema>;
