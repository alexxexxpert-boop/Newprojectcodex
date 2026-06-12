import cron from "node-cron";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { getQueuedKeywords, updateStatus, addPublishedRecord } from "./sheets.js";
import {
  getQueuedKeywordsFromFile,
  removeKeywordFromFile,
  markKeywordErrorInFile,
  appendPublishedCsv,
} from "./queue/file.js";
import { runPipeline } from "./pipeline/index.js";

let isRunning = false;

export function startScheduler(): void {
  const intervalMinutes = config.automation.pollIntervalMinutes;
  const cronExpression = `*/${intervalMinutes} * * * *`;

  logger.info(`Scheduler started — polling every ${intervalMinutes} minute(s)`);

  // Run immediately on startup
  void processQueue();

  cron.schedule(cronExpression, () => {
    void processQueue();
  });
}

export async function processQueue(): Promise<void> {
  if (isRunning) {
    logger.info("Previous run still in progress, skipping this poll");
    return;
  }

  isRunning = true;
  logger.info(`Polling ${config.queue.mode} queue...`);

  try {
    if (config.queue.mode === "file") {
      await processFileQueue();
      return;
    }

    const queued = await getQueuedKeywords();

    if (queued.length === 0) {
      logger.info("Queue is empty, nothing to process");
      return;
    }

    logger.info(`Found ${queued.length} keyword(s) in queue`, {
      keywords: queued.map((k) => k.keyword),
    });

    for (const item of queued) {
      await processKeyword(item.keyword, item.rowIndex);
    }
  } catch (err) {
    logger.error("Failed to poll queue", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  } finally {
    isRunning = false;
  }
}

async function processFileQueue(): Promise<void> {
  const keywords = await getQueuedKeywordsFromFile();

  if (keywords.length === 0) {
    logger.info("Queue file is empty, nothing to process", {
      file: config.queue.file,
    });
    return;
  }

  logger.info(`Found ${keywords.length} keyword(s) in queue file`, { keywords });

  for (const keyword of keywords) {
    try {
      const result = await runPipeline(keyword);

      await removeKeywordFromFile(keyword);
      await appendPublishedCsv({
        keyword,
        articleUrl: result.publishResult.url,
        publishDate: new Date().toISOString().split("T")[0] ?? "",
        seoScore: result.auditScore,
        wordCount: result.article.wordCount,
      });

      logger.info("Keyword processed successfully", {
        keyword,
        url: result.publishResult.url,
      });
    } catch (err) {
      logger.error("Failed to process keyword", {
        keyword,
        error: err instanceof Error ? err.message : String(err),
      });
      try {
        await markKeywordErrorInFile(keyword);
      } catch (fileErr) {
        logger.error("Failed to mark error in queue file", {
          error: fileErr instanceof Error ? fileErr.message : String(fileErr),
        });
      }
    }
  }
}

async function processKeyword(keyword: string, rowIndex: number): Promise<void> {
  logger.info("Processing keyword", { keyword, rowIndex });

  try {
    // Mark as in-progress so it won't be picked up again
    await updateStatus(rowIndex, "processing");

    const result = await runPipeline(keyword);

    await updateStatus(rowIndex, "done");
    await addPublishedRecord({
      keyword,
      articleUrl: result.publishResult.url,
      publishDate: new Date().toISOString().split("T")[0] ?? "",
      seoScore: result.auditScore,
      wordCount: result.article.wordCount,
      status: "published",
    });

    logger.info("Keyword processed successfully", {
      keyword,
      url: result.publishResult.url,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Failed to process keyword", { keyword, error: message });

    try {
      await updateStatus(rowIndex, "error");
    } catch (sheetErr) {
      logger.error("Failed to update status to error in sheets", {
        error: sheetErr instanceof Error ? sheetErr.message : String(sheetErr),
      });
    }
  }
}
