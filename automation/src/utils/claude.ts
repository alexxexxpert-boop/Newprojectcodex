import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { withRetry } from "./retry.js";

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

export interface ClaudeOptions {
  temperature?: number;
  maxTokens?: number;
}

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  options: ClaudeOptions = {}
): Promise<string> {
  const { temperature = 0.5, maxTokens = 4096 } = options;

  return withRetry(async () => {
    const response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = response.content[0];
    if (block.type !== "text") throw new Error("Unexpected response type from Claude");
    return block.text;
  });
}

export function parseJsonFromClaude<T>(raw: string): T {
  // Claude sometimes wraps JSON in ```json ... ``` fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenced ? fenced[1] : raw;
  return JSON.parse(jsonStr.trim()) as T;
}
