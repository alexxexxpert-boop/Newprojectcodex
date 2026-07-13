import { callLLM, parseJsonFromLLM } from "../utils/llm.js";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";
import { mockAudit } from "../mocks/index.js";

export interface AuditResult {
  score: number; // 0–100
  suggestions: string[];
  approved: boolean;
}

const AUDITOR_SYSTEM = `Ты SEO-аудитор контента. Анализируй статьи строго и объективно.
Отвечай ТОЛЬКО валидным JSON без комментариев.`;

export async function auditContent(
  keyword: string,
  fullArticle: string
): Promise<AuditResult> {
  if (config.dryRun) {
    logger.info("[DRY RUN] Returning mock audit", { keyword });
    return mockAudit();
  }

  const wordCount = fullArticle.split(/\s+/).length;

  const userPrompt = `Проведи SEO-аудит статьи по ключевому слову: "${keyword}"

СТАТЬЯ (фрагмент, первые 3000 символов):
${fullArticle.slice(0, 3000)}

Статистика: ~${wordCount} слов.

КРИТЕРИИ ОЦЕНКИ (каждый от 0 до 20 баллов):
1. Плотность ключевого слова (оптимум 1-2%)
2. Структура H1/H2/H3 (логичная иерархия)
3. Читаемость (короткие предложения, списки)
4. Экспертность (факты, цифры, конкретика)
5. Объём (минимум 2000 слов)

Верни JSON:
{
  "score": 85,
  "suggestions": [
    "Увеличить плотность ключевого слова в H2 разделах",
    "Добавить больше конкретных примеров в раздел X"
  ],
  "approved": true
}

approved: true если score >= 65.`;

  logger.info("Auditing article content", { keyword, wordCount });

  try {
    const raw = await callLLM(AUDITOR_SYSTEM, userPrompt, {
      temperature: 0.2,
      maxTokens: 1024,
    });
    const result = parseJsonFromLLM<AuditResult>(raw);

    if (result.score < 65) {
      logger.warn("Article scored below threshold, publishing anyway", {
        keyword,
        score: result.score,
        suggestions: result.suggestions,
      });
      result.approved = false;
    }

    logger.info("Audit complete", { keyword, score: result.score });
    return result;
  } catch (err) {
    logger.warn("Audit failed, defaulting to approved=true", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { score: 0, suggestions: [], approved: true };
  }
}
