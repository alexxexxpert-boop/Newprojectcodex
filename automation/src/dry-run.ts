// Runs the FULL pipeline end-to-end with mock data — no real API keys,
// no WordPress, no Google Sheets. Produces a real HTML article in output/.
//
//   npm run dry-run -- "ваше ключевое слово"

process.env.DRY_RUN = "true";

async function main(): Promise<void> {
  // Dynamic imports so DRY_RUN is set before config.ts is evaluated.
  const { runPipeline } = await import("./pipeline/index.js");
  const { logger } = await import("./utils/logger.js");

  const keyword =
    process.argv.slice(2).join(" ") || "как заработать на маркетплейсах";

  logger.info("════════════════════════════════════════════════════");
  logger.info(`DRY RUN — генерируем статью для: "${keyword}"`);
  logger.info("════════════════════════════════════════════════════");

  try {
    const result = await runPipeline(keyword);
    logger.info("════════════════════════════════════════════════════");
    logger.info("✅ ГОТОВО — вся цепочка отработала на моках");
    logger.info(`📄 Файл статьи: ${result.publishResult.url}`);
    logger.info(
      `📊 SEO score: ${result.auditScore} · слов: ${result.article.wordCount}`
    );
    logger.info("════════════════════════════════════════════════════");
    process.exit(0);
  } catch (err) {
    logger.error("Dry run failed", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    process.exit(1);
  }
}

void main();
