import { callClaude } from "../utils/claude.js";
import { logger } from "../utils/logger.js";
import type { ArticleOutline, Section } from "./planner.js";
import type { SectionResearch } from "./researcher.js";

export interface WrittenSection {
  h2: string;
  content: string; // Markdown
}

const WRITER_SYSTEM = `Ты профессиональный SEO-копирайтер для русскоязычной аудитории.
Ты пишешь экспертные, живые статьи — как объясняешь другу, но с фактами и цифрами.
Пиши Markdown: используй H3 для подзаголовков, списки и таблицы где уместно.
Никогда не используй вводные фразы типа "Конечно!" или "Вот текст раздела:".
Начинай сразу с контента.`;

export async function writeSections(
  keyword: string,
  outline: ArticleOutline,
  researchData: Map<string, SectionResearch>
): Promise<WrittenSection[]> {
  const written: WrittenSection[] = [];

  for (const section of outline.sections) {
    const research = researchData.get(section.h2);
    const content = await writeSingleSection(keyword, outline, section, research);
    written.push({ h2: section.h2, content });
    logger.info("Section written", {
      keyword,
      h2: section.h2,
      chars: content.length,
    });
  }

  return written;
}

async function writeSingleSection(
  keyword: string,
  outline: ArticleOutline,
  section: Section,
  research: SectionResearch | undefined
): Promise<string> {
  const subsectionsList = section.subsections
    .map((s) => `  - ### ${s.h3}: ${s.description}`)
    .join("\n");

  const researchBlock = research?.researchData
    ? `\nFACTS & RESEARCH:\n${research.researchData}`
    : "";

  const sourcesBlock =
    research?.sources && research.sources.length > 0
      ? `\nSOURCES: ${research.sources.slice(0, 3).join(", ")}`
      : "";

  const userPrompt = `Напиши раздел статьи:

## ${section.h2}

КОНТЕКСТ:
- Тема статьи: "${keyword}"
- Intro статьи: "${outline.intro}"
- Задача раздела: ${section.description}

ПОДРАЗДЕЛЫ (обязательно включи):
${subsectionsList}
${researchBlock}
${sourcesBlock}

ТРЕБОВАНИЯ:
- Объём: ~${section.wordCount} слов
- Начни с прямого ответа на вопрос в H2
- Используй факты из research (если есть)
- Короткие предложения (до 20 слов)
- Разговорный тон, конкретные примеры и цифры
${section.hasTable ? "- Включи таблицу сравнения" : ""}
- Пиши H3 подзаголовки как указано выше

Верни ТОЛЬКО текст раздела в Markdown, без H2 заголовка (он добавится автоматически).`;

  return callClaude(WRITER_SYSTEM, userPrompt, {
    temperature: 0.6,
    maxTokens: 2048,
  });
}
