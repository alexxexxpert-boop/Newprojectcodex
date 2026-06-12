import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";
import { mockResearch } from "../mocks/index.js";
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

  if (config.dryRun) {
    logger.info("[DRY RUN] Returning mock research", { keyword });
    for (const section of sections) {
      results.set(section.h2, mockResearch(section.h2));
    }
    return results;
  }

  const hasSearch = config.tavily.enabled || config.perplexity.enabled;

  if (!hasSearch) {
    logger.info("No search API configured (Tavily/Perplexity), skipping research phase", { keyword });
    for (const section of sections) {
      results.set(section.h2, { researchData: "", sources: [] });
    }
    return results;
  }

  const provider = config.tavily.enabled ? "Tavily" : "Perplexity";
  logger.info(`Research provider: ${provider}`, { keyword });

  for (const section of sections) {
    try {
      const research = await withRetry(() =>
        config.tavily.enabled
          ? fetchTavilyResearch(keyword, section.h2)
          : fetchPerplexityResearch(keyword, section.h2)
      );
      results.set(section.h2, research);
      logger.info("Section researched", { keyword, h2: section.h2, provider });
    } catch (err) {
      logger.warn(`${provider} research failed for section, continuing without`, {
        h2: section.h2,
        error: err instanceof Error ? err.message : String(err),
      });
      results.set(section.h2, { researchData: "", sources: [] });
    }
  }

  return results;
}

async function fetchTavilyResearch(
  keyword: string,
  h2Title: string
): Promise<SectionResearch> {
  const query = `${h2Title} — ${keyword} актуальные данные факты статистика 2024 2025`;

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.tavily.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      include_answer: true,
      max_results: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    answer?: string;
    results?: { url: string; content: string; title: string }[];
  };

  const snippets = (data.results ?? [])
    .map((r) => `[${r.title}] ${r.content}`)
    .join("\n\n");

  const researchData = data.answer
    ? `${data.answer}\n\n${snippets}`
    : snippets;

  const sources = (data.results ?? []).map((r) => r.url);

  return { researchData, sources };
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
