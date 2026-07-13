import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";
import { mockKeywordData } from "../mocks/index.js";

export interface KeywordData {
  seedKeyword: string;
  searchVolume: number;
  difficulty: number;
  relatedKeywords: RelatedKeyword[];
}

export interface RelatedKeyword {
  keyword: string;
  searchVolume: number;
  difficulty: number;
}

export async function researchKeywords(keyword: string): Promise<KeywordData> {
  if (config.dryRun) {
    logger.info("[DRY RUN] Returning mock keyword data", { keyword });
    return mockKeywordData(keyword);
  }

  if (!config.semrush.enabled) {
    logger.info("Semrush API not configured, using seed keyword only", { keyword });
    return { seedKeyword: keyword, searchVolume: 0, difficulty: 0, relatedKeywords: [] };
  }

  try {
    return await withRetry(async () => {
      const url = new URL("https://api.semrush.com/");
      url.searchParams.set("type", "phrase_related");
      url.searchParams.set("key", config.semrush.apiKey);
      url.searchParams.set("phrase", keyword);
      url.searchParams.set("database", "ru");
      url.searchParams.set("export_columns", "Ph,Nq,Kd");
      url.searchParams.set("display_limit", "20");

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`Semrush API error: ${response.status}`);

      const text = await response.text();
      const lines = text.trim().split("\n").slice(1); // skip header

      const relatedKeywords: RelatedKeyword[] = lines
        .map((line) => {
          const [kw, volume, kd] = line.split(";");
          return {
            keyword: kw ?? "",
            searchVolume: parseInt(volume ?? "0", 10),
            difficulty: parseInt(kd ?? "0", 10),
          };
        })
        .filter(
          (k) => k.keyword && k.searchVolume > 50 && k.difficulty < 50
        )
        .slice(0, 10);

      logger.info("Semrush keywords fetched", {
        keyword,
        relatedCount: relatedKeywords.length,
      });

      return { seedKeyword: keyword, searchVolume: 0, difficulty: 0, relatedKeywords };
    });
  } catch (err) {
    logger.warn("Semrush research failed, continuing without related keywords", {
      keyword,
      error: err instanceof Error ? err.message : String(err),
    });
    return { seedKeyword: keyword, searchVolume: 0, difficulty: 0, relatedKeywords: [] };
  }
}
