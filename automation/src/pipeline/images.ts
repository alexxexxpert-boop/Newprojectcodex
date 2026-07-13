import { callLLM, parseJsonFromLLM } from "../utils/llm.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";
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

// ─── Fal.ai response shape ────────────────────────────────────────────────────

interface FalImage {
  url: string;
  width: number;
  height: number;
  content_type: string;
}

interface FalResponse {
  images: FalImage[];
  seed?: number;
  prompt?: string;
}

// ─── Prompt generation ────────────────────────────────────────────────────────

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

ВАЖНО — требования к промптам:
- Формат ШИРОКИЙ ПАНОРАМНЫЙ баннер 8:1 (очень широкий и низкий)
- Горизонтальная композиция с центральным объектом и размытыми краями
- Профессиональный корпоративный стиль, мягкое освещение
- Никакого текста внутри изображения
- Никаких лиц людей крупным планом
- Иллюстрирует концепцию раздела
- Стиль: wide panoramic banner, professional corporate photography style, shallow depth of field, soft background

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
    logger.warn("Image prompt generation failed, using fallback prompts", {
      error: err instanceof Error ? err.message : String(err),
    });
    return h2Titles.map((h2) => ({
      h2,
      fluxPrompt: `Wide panoramic banner, professional corporate style: ${h2}, horizontal composition, soft lighting, shallow depth of field, no text, no faces, 8:1 aspect ratio`,
      altText: h2,
      caption: h2,
    }));
  }
}

// ─── Image generation via Fal.ai ──────────────────────────────────────────────

export async function generateImages(
  prompts: ImagePrompt[]
): Promise<GeneratedImage[]> {
  if (!config.falAi.enabled) {
    logger.info("Fal.ai not configured (FAL_AI_KEY missing), skipping image generation");
    return prompts.map((p) => ({
      h2: p.h2,
      imageUrl: "",
      altText: p.altText,
      caption: p.caption,
    }));
  }

  const results: GeneratedImage[] = [];

  for (const prompt of prompts) {
    try {
      const imageUrl = await withRetry(() => callFalAi(prompt.fluxPrompt), 3, 2000);
      results.push({ h2: prompt.h2, imageUrl, altText: prompt.altText, caption: prompt.caption });
      logger.info("Image generated via Fal.ai", { h2: prompt.h2 });
    } catch (err) {
      logger.warn("Fal.ai image generation failed for section, skipping", {
        h2: prompt.h2,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({ h2: prompt.h2, imageUrl: "", altText: prompt.altText, caption: prompt.caption });
    }
  }

  return results;
}

async function callFalAi(prompt: string): Promise<string> {
  const endpoint = `https://fal.run/${config.falAi.model}`;

  // Use 1920x480 wide panoramic format — WordPress crops to 1920x240 for article banners
  const imageSize = { width: 1920, height: 480 };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Key ${config.falAi.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: imageSize,
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Fal.ai error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as FalResponse;
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("Fal.ai returned no image URL");
  return url;
}
