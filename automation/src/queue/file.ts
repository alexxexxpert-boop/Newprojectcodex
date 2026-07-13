// File-based queue — the simple alternative to Google Sheets.
// Keywords live in a plain text file (one per line, # = comment).
// Processed lines are removed; results are appended to published.csv
// next to the queue file; failures are commented out with an error mark.
import { readFile, writeFile, appendFile, mkdir } from "fs/promises";
import path from "path";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const SAMPLE_CONTENT = `# Очередь статей — одно ключевое слово (тема) на строку.
# Строки, начинающиеся с #, игнорируются.
# Успешно обработанные строки удаляются автоматически,
# результат записывается в published.csv рядом с этим файлом.
#
# Примеры (раскомментируй или добавь свои):
# как выбрать пресс-волл для мероприятия
# пресс волл на свадьбу: идеи и цены
`;

function queueFilePath(): string {
  return path.resolve(process.cwd(), config.queue.file);
}

function publishedCsvPath(): string {
  return path.join(path.dirname(queueFilePath()), "published.csv");
}

export async function getQueuedKeywordsFromFile(): Promise<string[]> {
  const file = queueFilePath();
  let text: string;
  try {
    text = await readFile(file, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, SAMPLE_CONTENT, "utf-8");
      logger.info("Queue file created — add keywords to it", { file });
      return [];
    }
    throw err;
  }

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

export async function removeKeywordFromFile(keyword: string): Promise<void> {
  await rewriteLine(keyword, null);
}

export async function markKeywordErrorInFile(keyword: string): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  await rewriteLine(keyword, `# ERROR ${stamp}: ${keyword}`);
}

async function rewriteLine(keyword: string, replacement: string | null): Promise<void> {
  const file = queueFilePath();
  const text = await readFile(file, "utf-8");
  const lines = text.split("\n");
  const out: string[] = [];
  let done = false;

  for (const line of lines) {
    if (!done && line.trim() === keyword) {
      done = true;
      if (replacement !== null) out.push(replacement);
      continue;
    }
    out.push(line);
  }

  await writeFile(file, out.join("\n"), "utf-8");
}

export interface FilePublishedRecord {
  keyword: string;
  articleUrl: string;
  publishDate: string;
  seoScore: number;
  wordCount: number;
}

export async function appendPublishedCsv(record: FilePublishedRecord): Promise<void> {
  const file = publishedCsvPath();
  let needHeader = false;
  try {
    await readFile(file, "utf-8");
  } catch {
    needHeader = true;
  }

  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const row =
    [record.keyword, record.articleUrl, record.publishDate, record.seoScore, record.wordCount]
      .map(esc)
      .join(",") + "\n";

  await appendFile(
    file,
    (needHeader ? `"Keyword","URL","Date","SEO Score","Words"\n` : "") + row,
    "utf-8"
  );
  logger.info("Published record appended", { file, keyword: record.keyword });
}
