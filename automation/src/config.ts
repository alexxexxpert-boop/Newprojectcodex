import "dotenv/config";

// In dry-run mode the pipeline uses mock data, so real credentials are not
// required — missing keys fall back to harmless placeholders.
const DRY_RUN = process.env.DRY_RUN === "true";

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    if (DRY_RUN) return `dry-run-${key}`;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

// Queue mode: "file" reads keywords from a local text file (no Google Cloud
// setup needed); "sheets" uses Google Sheets. Defaults to "sheets" when
// GOOGLE_SHEETS_ID is set, otherwise "file".
const queueMode = (optional(
  "QUEUE_MODE",
  process.env["GOOGLE_SHEETS_ID"] ? "sheets" : "file"
) as "sheets" | "file");

function requiredForSheets(key: string): string {
  return queueMode === "sheets" ? required(key) : optional(key);
}

export type LlmProvider = "anthropic" | "openrouter";

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  // OpenRouter optional attribution headers
  referer: string;
  title: string;
}

function buildLlmConfig(): LlmConfig {
  const provider = (optional("LLM_PROVIDER", "anthropic") as LlmProvider);

  if (provider === "openrouter") {
    return {
      provider,
      apiKey: required("OPENROUTER_API_KEY"),
      // Any OpenRouter model slug, e.g. anthropic/claude-3.5-sonnet,
      // openai/gpt-4o, google/gemini-pro-1.5, deepseek/deepseek-chat
      model: optional("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet"),
      referer: optional("OPENROUTER_REFERER", "https://example.com"),
      title: optional("OPENROUTER_TITLE", "Kyber SEO Automation"),
    };
  }

  return {
    provider: "anthropic",
    apiKey: required("ANTHROPIC_API_KEY"),
    model: optional("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
    referer: "",
    title: "",
  };
}

export const config = {
  wordpress: {
    apiUrl: required("WP_API_URL"),
    username: required("WP_USERNAME"),
    appPassword: required("WP_APP_PASSWORD"),
  },
  nextjs: {
    siteUrl: required("NEXT_PUBLIC_SITE_URL"),
    revalidateSecret: optional("NEXTJS_REVALIDATE_SECRET"),
  },
  llm: buildLlmConfig(),
  tavily: {
    apiKey: optional("TAVILY_API_KEY"),
    enabled: !!process.env["TAVILY_API_KEY"],
  },
  perplexity: {
    apiKey: optional("PERPLEXITY_API_KEY"),
    enabled: !!process.env["PERPLEXITY_API_KEY"],
  },
  falAi: {
    apiKey: optional("FAL_AI_KEY"),
    enabled: !!process.env["FAL_AI_KEY"],
    // fal-ai/flux/schnell — синхронный эндпоинт, ~2-4с на картинку
    model: optional("FAL_AI_MODEL", "fal-ai/flux/schnell"),
    imageSize: optional("FAL_AI_IMAGE_SIZE", "landscape_16_9"),
  },
  semrush: {
    apiKey: optional("SEMRUSH_API_KEY"),
    enabled: !!process.env["SEMRUSH_API_KEY"],
  },
  queue: {
    mode: queueMode,
    // Path to the keywords file (relative to automation/), used in file mode
    file: optional("QUEUE_FILE", "queue/keywords.txt"),
  },
  googleSheets: {
    spreadsheetId: requiredForSheets("GOOGLE_SHEETS_ID"),
    serviceAccountEmail: requiredForSheets("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    privateKey: requiredForSheets("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(
      /\\n/g,
      "\n"
    ),
    queueSheet: "Queue",
    publishedSheet: "Published",
  },
  automation: {
    publishStatus: (optional("PUBLISH_STATUS", "draft") as "publish" | "draft"),
    pollIntervalMinutes: parseInt(optional("POLL_INTERVAL_MINUTES", "5"), 10),
  },
  dryRun: DRY_RUN,
};
