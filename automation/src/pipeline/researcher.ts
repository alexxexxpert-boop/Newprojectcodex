import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";
import type { Section } from "./planner.js";

export interface SectionResearch {
  researchData: string;
  sources: string[];
}

export async function researchSections(
  keyword: string,
  sections: Section[]
): Promise<Map<string, SectionResearch>> {
  const results = new Map<string, SectionResearch>();

  if (!config.perplexity.enabled) {
    logger.info("Perplexity API not configured, skipping research phase", { keyword });
    for (const section of sections) {
      results.set(section.h2, { researchData: "", sources: [] });
    }
    return results;
  }

  for (const section of sections) {
    try {
      const research = await withRetry(() =>
        fetchPerplexityResearch(keyword, section.h2)
      );
      results.set(section.h2, research);
      logger.info("Section researched", { keyword, h2: section.h2 });
    } catch (err) {
      logger.warn("Perplexity research failed for section, continuing without", {
        h2: section.h2,
        error: err instanceof Error ? err.message : String(err),
      });
      results.set(section.h2, { researchData: "", sources: [] });
    }
  }

  return results;
}

async function fetchPerplexityResearch(
  keyword: string,
  h2Title: string
): Promise<SectionResearch> {
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.perplexity.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        {
          role: "user",
          content: `Исследуй тему: "${h2Title}". Контекст статьи: "${keyword}".
Найди актуальные факты, статистику, примеры, данные 2024-2025.
Приведи конкретные цифры и авторитетные источники на русском языке.
Ответ в формате: факты и данные (3-5 абзацев).`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
    citations?: string[];
  };

  return {
    researchData: data.choices[0]?.message.content ?? "",
    sources: data.citations ?? [],
  };
}
