import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/env";

export const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

export function getAnthropicClient(): Anthropic {
  const key = getAnthropicApiKey() ?? process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY");
  return new Anthropic({ apiKey: key });
}
