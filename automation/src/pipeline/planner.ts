import { callClaude, parseJsonFromClaude } from "../utils/claude.js";
import { logger } from "../utils/logger.js";
import type { RelatedKeyword } from "./keywords.js";

export interface Subsection {
  h3: string;
  description: string;
}

export interface Section {
  h2: string;
  description: string;
  hasTable: boolean;
  subsections: Subsection[];
  wordCount: number;
}

export interface FaqItem {
  question: string;
  shortAnswer: string;
}

export interface ArticleOutline {
  h1: string;
  slug: string;
  metaDescription: string;
  intro: string;
  sections: Section[];
  faq: FaqItem[];
  conclusion: string;
  cta: string;
  estimatedWordCount: number;
}

const SYSTEM_PROMPT = `Ты SEO-стратег и контент-планировщик уровня Google Level.
Твоя специализация: русскоязычный контент для России и СНГ.
Ты создаёшь структуры статей, которые побеждают в поисковой выдаче.
Отвечай ТОЛЬКО валидным JSON без комментариев и пояснений.`;

export async function planTopic(
  keyword: string,
  relatedKeywords: RelatedKeyword[]
): Promise<ArticleOutline> {
  const relatedList = relatedKeywords.map((k) => k.keyword).join(", ") || "нет";

  const userPrompt = `Создай детальную структуру статьи для ключевого слова: "${keyword}"

Связанные ключевые слова: ${relatedList}

ТРЕБОВАНИЯ:
1. H1 — главный заголовок (55-60 символов, включает ключевое слово)
2. Meta description (155-160 символов, с CTA)
3. Intro (2-3 предложения, прямой ответ на H1)
4. 8-10 H2 разделов, каждый:
   - Начинается с вопроса или проблемы
   - Имеет 2-3 H3 подраздела
   - Краткое описание что писать
5. Таблица сравнения (если применимо) — hasTable: true
6. FAQ блок (5-7 вопросов с короткими ответами)
7. Заключение + CTA

Верни JSON строго в этом формате:
{
  "h1": "Заголовок статьи",
  "slug": "url-friendly-slug-transliterated",
  "metaDescription": "Meta description 155-160 символов",
  "intro": "Вводный абзац 2-3 предложения",
  "sections": [
    {
      "h2": "Заголовок раздела?",
      "description": "Что писать в этом разделе",
      "hasTable": false,
      "subsections": [
        { "h3": "Подраздел 1.1", "description": "Описание" }
      ],
      "wordCount": 300
    }
  ],
  "faq": [
    { "question": "Вопрос?", "shortAnswer": "Краткий ответ" }
  ],
  "conclusion": "Краткое заключение",
  "cta": "Призыв к действию",
  "estimatedWordCount": 2500
}`;

  logger.info("Planning article outline", { keyword });
  const raw = await callClaude(SYSTEM_PROMPT, userPrompt, {
    temperature: 0.4,
    maxTokens: 4096,
  });

  const outline = parseJsonFromClaude<ArticleOutline>(raw);
  logger.info("Article outline ready", {
    keyword,
    sections: outline.sections.length,
    estimatedWords: outline.estimatedWordCount,
  });
  return outline;
}
