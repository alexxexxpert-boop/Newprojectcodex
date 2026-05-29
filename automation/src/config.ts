import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optional(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
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
  anthropic: {
    apiKey: required("ANTHROPIC_API_KEY"),
    model: "claude-sonnet-4-6",
  },
  perplexity: {
    apiKey: optional("PERPLEXITY_API_KEY"),
    enabled: !!process.env["PERPLEXITY_API_KEY"],
  },
  replicate: {
    apiToken: optional("REPLICATE_API_TOKEN"),
    enabled: !!process.env["REPLICATE_API_TOKEN"],
    // flux-schnell model version
    modelVersion:
      "5f24084160c9089501c1b3545d9be3c27883ae2239b6f412990e82d4a6210f8f",
  },
  semrush: {
    apiKey: optional("SEMRUSH_API_KEY"),
    enabled: !!process.env["SEMRUSH_API_KEY"],
  },
  googleSheets: {
    spreadsheetId: required("GOOGLE_SHEETS_ID"),
    serviceAccountEmail: required("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    privateKey: required("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(
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
};
