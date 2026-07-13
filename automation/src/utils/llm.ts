import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { withRetry } from "./retry.js";

export interface LlmOptions {
  temperature?: number;
  maxTokens?: number;
}

// Lazily created so dry-run / OpenRouter modes never construct the SDK.
let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: config.llm.apiKey });
  }
  return anthropicClient;
}

/**
 * Provider-agnostic LLM call. Uses the Anthropic SDK when LLM_PROVIDER is
 * "anthropic", or OpenRouter's OpenAI-compatible endpoint when "openrouter".
 */
export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: LlmOptions = {}
): Promise<string> {
  const { temperature = 0.5, maxTokens = 4096 } = options;

  return withRetry(async () => {
    if (config.llm.provider === "openrouter") {
      return callOpenRouter(systemPrompt, userPrompt, temperature, maxTokens);
    }
    return callAnthropic(systemPrompt, userPrompt, temperature, maxTokens);
  });
}

async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const response = await getAnthropic().messages.create({
    model: config.llm.model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Anthropic");
  return block.text;
}

async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.llm.apiKey}`,
      "Content-Type": "application/json",
      // Optional attribution headers (recommended by OpenRouter)
      "HTTP-Referer": config.llm.referer,
      "X-Title": config.llm.title,
    },
    body: JSON.stringify({
      model: config.llm.model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  const content = data.choices[0]?.message.content;
  if (!content) throw new Error("Empty response from OpenRouter");
  return content;
}

export function parseJsonFromLLM<T>(raw: string): T {
  // Models sometimes wrap JSON in ```json ... ``` fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenced ? fenced[1] : raw;
  return JSON.parse(jsonStr.trim()) as T;
}
