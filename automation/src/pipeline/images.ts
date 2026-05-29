import { callLLM, parseJsonFromLLM } from "../utils/llm.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { sleep } from "../utils/retry.js";
import { mockImagePrompts } from "../mocks/index.js";

export interface ImagePrompt {
  h2: string;
  fluxPrompt: string;
  altText: string;
  caption: string;
}

export interface GeneratedImage {
  h2: string;
  imageUrl: string;
  altText: string;
  caption: string;
}

const PROMPT_SYSTEM = `Ты специалист по созданию промптов для text-to-image моделей (Flux).
Отвечай ТОЛЬКО валидным JSON без комментариев.`;

export async function generateImagePrompts(
  keyword: string,
  h2Titles: string[]
): Promise<ImagePrompt[]> {
  if (config.dryRun) {
    logger.info("[DRY RUN] Returning mock image prompts", { keyword });
    return mockImagePrompts(h2Titles);
  }

  const userPrompt = `Создай промпты для изображений для каждого H2 раздела статьи о "${keyword}".

H2 РАЗДЕЛЫ:
${h2Titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Для каждого создай:
1. fluxPrompt (английский, 80-120 слов, детальный, профессиональный стиль)
2. altText (русский, описание для HTML alt атрибута, 10-15 слов)
3. caption (русский, подпись под картинкой, 5-10 слов)

Требования к промптам:
- Профессиональный, современный стиль
- Никакого текста внутри изображения
- Никаких лиц людей крупным планом
- Иллюстрирует концепцию раздела
- Стиль: clean digital illustration, soft lighting

Верни JSON массив:
[
  {
    "h2": "название раздела",
    "fluxPrompt": "...",
    "altText": "...",
    "caption": "..."
  }
]`;

  logger.info("Generating image prompts", { keyword, count: h2Titles.length });

  try {
    const raw = await callLLM(PROMPT_SYSTEM, userPrompt, {
      temperature: 0.7,
      maxTokens: 3000,
    });
    return parseJsonFromLLM<ImagePrompt[]>(raw);
  } catch (err) {
    logger.warn("Image prompt generation failed, using empty prompts", {
      error: err instanceof Error ? err.message : String(err),
    });
    return h2Titles.map((h2) => ({
      h2,
      fluxPrompt: "",
      altText: h2,
      caption: h2,
    }));
  }
}

export async function generateImages(
  prompts: ImagePrompt[]
): Promise<GeneratedImage[]> {
  if (!config.replicate.enabled) {
    logger.info("Replicate not configured, using placeholder images");
    return prompts.map((p) => ({
      h2: p.h2,
      imageUrl: "",
      altText: p.altText,
      caption: p.caption,
    }));
  }

  const results: GeneratedImage[] = [];

  for (const prompt of prompts) {
    if (!prompt.fluxPrompt) {
      results.push({ h2: prompt.h2, imageUrl: "", altText: prompt.altText, caption: prompt.caption });
      continue;
    }

    try {
      const imageUrl = await runFluxPrediction(prompt.fluxPrompt);
      results.push({ h2: prompt.h2, imageUrl, altText: prompt.altText, caption: prompt.caption });
      logger.info("Image generated", { h2: prompt.h2 });
    } catch (err) {
      logger.warn("Image generation failed for section", {
        h2: prompt.h2,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({ h2: prompt.h2, imageUrl: "", altText: prompt.altText, caption: prompt.caption });
    }
  }

  return results;
}

async function runFluxPrediction(prompt: string): Promise<string> {
  const createRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${config.replicate.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: config.replicate.modelVersion,
      input: { prompt, num_outputs: 1, aspect_ratio: "16:9" },
    }),
  });

  if (!createRes.ok) throw new Error(`Replicate create error: ${createRes.status}`);
  const prediction = (await createRes.json()) as { id: string; urls: { get: string } };

  // Poll for completion (max 90 seconds)
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await sleep(3000);
    const pollRes = await fetch(prediction.urls.get, {
      headers: { Authorization: `Token ${config.replicate.apiToken}` },
    });
    if (!pollRes.ok) throw new Error(`Replicate poll error: ${pollRes.status}`);

    const status = (await pollRes.json()) as {
      status: string;
      output?: string[];
      error?: string;
    };

    if (status.status === "succeeded" && status.output?.[0]) {
      return status.output[0];
    }
    if (status.status === "failed") {
      throw new Error(`Replicate prediction failed: ${status.error ?? "unknown"}`);
    }
  }

  throw new Error("Replicate prediction timed out after 90 seconds");
}
