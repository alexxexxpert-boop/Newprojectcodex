// Realistic mock data for DRY_RUN mode. Lets the entire pipeline run
// end-to-end with no real API keys, no WordPress, and no Google Sheets.
import type { KeywordData } from "../pipeline/keywords.js";
import type { ArticleOutline } from "../pipeline/planner.js";
import type { SectionResearch } from "../pipeline/researcher.js";
import type { AuditResult } from "../pipeline/auditor.js";
import type { ImagePrompt } from "../pipeline/images.js";

export function mockKeywordData(keyword: string): KeywordData {
  return {
    seedKeyword: keyword,
    searchVolume: 8100,
    difficulty: 34,
    relatedKeywords: [
      { keyword: `${keyword} для новичков`, searchVolume: 2400, difficulty: 28 },
      { keyword: `${keyword} пошагово`, searchVolume: 1300, difficulty: 31 },
      { keyword: `${keyword} в 2025`, searchVolume: 880, difficulty: 22 },
    ],
  };
}

export function mockOutline(keyword: string): ArticleOutline {
  const slug = transliterate(keyword);
  return {
    h1: `${capitalize(keyword)}: полное руководство`,
    slug,
    metaDescription: `Разбираем ${keyword} простыми словами. Пошаговая инструкция, примеры и частые ошибки. Всё что нужно знать новичку.`,
    intro: `${capitalize(keyword)} — это проще, чем кажется. В этом руководстве разберём всё по шагам, с конкретными примерами и цифрами.`,
    sections: [
      {
        h2: `Что такое ${keyword} простыми словами?`,
        description: "Базовое объяснение для новичка",
        hasTable: false,
        subsections: [
          { h3: "Определение", description: "Суть в двух предложениях" },
          { h3: "Зачем это нужно", description: "Практическая польза" },
        ],
        wordCount: 300,
      },
      {
        h2: `Как начать: пошаговая инструкция`,
        description: "Конкретные шаги с нуля",
        hasTable: true,
        subsections: [
          { h3: "Шаг 1: подготовка", description: "Что подготовить заранее" },
          { h3: "Шаг 2: первые действия", description: "С чего начать" },
        ],
        wordCount: 450,
      },
      {
        h2: `Частые ошибки и как их избежать`,
        description: "Типичные грабли новичков",
        hasTable: false,
        subsections: [
          { h3: "Ошибка №1", description: "Самая распространённая" },
          { h3: "Ошибка №2", description: "Дорогая ошибка" },
        ],
        wordCount: 350,
      },
    ],
    faq: [
      { question: `Сколько времени занимает ${keyword}?`, shortAnswer: "От нескольких дней до пары недель, зависит от подхода." },
      { question: "Нужны ли вложения на старте?", shortAnswer: "Можно начать без вложений, но они ускоряют результат." },
      { question: "Подходит ли это новичку?", shortAnswer: "Да, руководство рассчитано именно на новичков." },
    ],
    conclusion: `Теперь вы знаете основы темы «${keyword}». Главное — начать с малого и двигаться по шагам.`,
    cta: "Начните прямо сегодня — сделайте первый шаг из инструкции выше.",
    estimatedWordCount: 1100,
  };
}

export function mockResearch(h2: string): SectionResearch {
  return {
    researchData: `[MOCK] Актуальные данные по теме «${h2}»: по статистике 2024-2025 года, около 67% новичков добиваются первых результатов в течение месяца. Средний показатель роста составляет 23% при системном подходе.`,
    sources: ["https://example.ru/research", "https://habr.com/example"],
  };
}

export function mockSectionContent(h2: string): string {
  return `Короткий прямой ответ на вопрос «${h2}». Это работает и вот почему.

### Главное по теме

Разберём суть. По данным исследований, системный подход даёт результат в 67% случаев. Это подтверждается практикой.

- Первый важный момент
- Второй ключевой фактор
- Третий нюанс, о котором забывают

### Практический пример

Допустим, вы только начали. За первую неделю реально достичь базового результата, если следовать шагам. Конкретные цифры: рост около 23% в месяц.`;
}

export function mockImagePrompts(h2Titles: string[]): ImagePrompt[] {
  return h2Titles.map((h2) => ({
    h2,
    fluxPrompt: `Clean modern digital illustration representing the concept of "${h2}", soft lighting, professional, no text, no faces`,
    altText: `Иллюстрация к разделу: ${h2}`,
    caption: `Визуализация: ${h2}`,
  }));
}

export function mockAudit(): AuditResult {
  return {
    score: 82,
    suggestions: [
      "[MOCK] Добавить больше внутренних ссылок",
      "[MOCK] Увеличить плотность ключевого слова в подзаголовках",
    ],
    approved: true,
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", " ": "-",
};

function transliterate(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? (/[a-z0-9-]/.test(ch) ? ch : ""))
    .join("")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
