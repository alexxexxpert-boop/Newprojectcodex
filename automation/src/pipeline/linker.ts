import { readFile } from "fs/promises";
import path from "path";
import { callLLM, parseJsonFromLLM } from "../utils/llm.js";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";

interface PublishedArticle {
  keyword: string;
  url: string;
}

async function loadPublishedArticles(): Promise<PublishedArticle[]> {
  const csvPath = path.resolve(
    process.cwd(),
    path.dirname(config.queue.file),
    "published.csv"
  );
  try {
    const text = await readFile(csvPath, "utf-8");
    const lines = text.trim().split("\n").slice(1); // skip header
    return lines
      .map((line) => {
        const parts = line.split(",").map((p) => p.replace(/^"|"$/g, "").replace(/""/g, '"'));
        return { keyword: parts[0] ?? "", url: parts[1] ?? "" };
      })
      .filter((a) => a.keyword && a.url && a.url.startsWith("http"));
  } catch {
    return [];
  }
}

interface SelectedLink {
  keyword: string;
  url: string;
  anchorText: string;
}

async function selectRelated(
  currentKeyword: string,
  candidates: PublishedArticle[]
): Promise<SelectedLink[]> {
  if (candidates.length === 0) return [];

  const list = candidates.map((a, i) => `${i + 1}. "${a.keyword}" — ${a.url}`).join("\n");

  const raw = await callLLM(
    "Ты SEO-специалист. Отвечай ТОЛЬКО валидным JSON без комментариев.",
    `Текущая статья о: "${currentKeyword}"

Список опубликованных статей на сайте:
${list}

Выбери 2-3 статьи, которые НАИБОЛЕЕ тематически близки к текущей и хорошо подойдут для внутренней перелинковки.
Для каждой придумай короткий естественный анкорный текст (5-8 слов на русском).

Верни JSON массив:
[
  { "keyword": "ключ статьи", "url": "https://...", "anchorText": "анкорный текст ссылки" }
]

Если ни одна статья не подходит — верни пустой массив [].`,
    { temperature: 0.3, maxTokens: 512 }
  );

  try {
    return parseJsonFromLLM<SelectedLink[]>(raw);
  } catch {
    return [];
  }
}

// Returns an HTML "Читайте также" block, or empty string if no related articles
export async function buildInternalLinksBlock(keyword: string): Promise<string> {
  if (config.dryRun) return "";

  try {
    const published = await loadPublishedArticles();
    if (published.length === 0) return "";

    const selected = await selectRelated(keyword, published);
    if (selected.length === 0) return "";

    const items = selected
      .map((l) => `<li><a href="${l.url}">${l.anchorText}</a></li>`)
      .join("\n");

    logger.info("Internal links selected", {
      keyword,
      count: selected.length,
      anchors: selected.map((l) => l.anchorText),
    });

    return `<div class="related-articles">\n<h3>Читайте также</h3>\n<ul>\n${items}\n</ul>\n</div>`;
  } catch (err) {
    logger.warn("Internal linking failed (non-critical)", {
      error: err instanceof Error ? err.message : String(err),
    });
    return "";
  }
}
