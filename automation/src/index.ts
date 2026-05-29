import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { startScheduler } from "./scheduler.js";

logger.info("Кибер СЕО & GEO Automation Service starting...", {
  publishStatus: config.automation.publishStatus,
  pollInterval: config.automation.pollIntervalMinutes,
  perplexityEnabled: config.perplexity.enabled,
  semrushEnabled: config.semrush.enabled,
  falAiEnabled: config.falAi.enabled,
});

startScheduler();

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received — shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received — shutting down");
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});
