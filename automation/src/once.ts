// Разовый прогон очереди — без cron и работы 24/7.
// Обработал все темы из очереди и завершился. Идеально для запуска вручную:
//   npm run once
import { processQueue } from "./scheduler.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  logger.info("Разовый прогон очереди (без планировщика)...");
  await processQueue();
  logger.info("Готово — очередь обработана, выходим.");
  process.exit(0);
}

void main();
