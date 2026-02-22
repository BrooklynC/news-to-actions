import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error(
    "Missing OPENAI_API_KEY. Add it to .env.local and restart the dev server."
  );
}

export const openai = new OpenAI({ apiKey });
