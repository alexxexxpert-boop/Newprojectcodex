import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";
import type { CompiledArticle } from "./compiler.js";

export interface PublishResult {
  id: number;
  url: string;
  slug: string;
}

interface WpPostResponse {
  id: number;
  link: string;
  slug: string;
}

function wpAuthHeader(): string {
  const credentials = `${config.wordpress.username}:${config.wordpress.appPassword}`;
  return "Basic " + Buffer.from(credentials).toString("base64");
}

export async function publishToWordPress(
  article: CompiledArticle
): Promise<PublishResult> {
  if (config.dryRun) {
    return publishToDisk(article);
  }

  logger.info("Publishing to WordPress", { slug: article.slug });

  // Resolve category IDs (create if missing)
  const categoryIds = await ensureCategories(article.categories);
  const tagIds = await ensureTags(article.tags);

  const postBody = {
    title: article.title,
    content: article.content,
    excerpt: article.excerpt,
    slug: article.slug,
    status: config.automation.publishStatus,
    categories: categoryIds,
    tags: tagIds,
    meta: {
      _yoast_wpseo_metadesc: article.metaDescription,
      _yoast_wpseo_title: article.title,
    },
  };

  const result = await withRetry(async () => {
    const response = await fetch(`${config.wordpress.apiUrl}/posts`, {
      method: "POST",
      headers: {
        Authorization: wpAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`WordPress publish error ${response.status}: ${body}`);
    }

    return (await response.json()) as WpPostResponse;
  });

  logger.info("Published to WordPress", { id: result.id, url: result.link });

  // Trigger Next.js ISR revalidation (non-critical, don't fail if this errors)
  if (config.nextjs.revalidateSecret) {
    await triggerRevalidation(article.slug).catch((err) => {
      logger.warn("ISR revalidation failed (non-critical)", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  return { id: result.id, url: result.link, slug: result.slug };
}

async function ensureCategories(names: string[]): Promise<number[]> {
  const ids: number[] = [];
  for (const name of names) {
    try {
      const id = await getOrCreateTerm("categories", name);
      ids.push(id);
    } catch {
      // non-critical
    }
  }
  return ids;
}

async function ensureTags(names: string[]): Promise<number[]> {
  const ids: number[] = [];
  for (const name of names.slice(0, 5)) {
    try {
      const id = await getOrCreateTerm("tags", name);
      ids.push(id);
    } catch {
      // non-critical
    }
  }
  return ids;
}

async function getOrCreateTerm(
  taxonomy: "categories" | "tags",
  name: string
): Promise<number> {
  const searchRes = await fetch(
    `${config.wordpress.apiUrl}/${taxonomy}?search=${encodeURIComponent(name)}`,
    { headers: { Authorization: wpAuthHeader() } }
  );
  if (searchRes.ok) {
    const terms = (await searchRes.json()) as { id: number; name: string }[];
    const existing = terms.find(
      (t) => t.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return existing.id;
  }

  const createRes = await fetch(`${config.wordpress.apiUrl}/${taxonomy}`, {
    method: "POST",
    headers: {
      Authorization: wpAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  if (!createRes.ok) throw new Error(`Cannot create term: ${name}`);
  const term = (await createRes.json()) as { id: number };
  return term.id;
}

async function triggerRevalidation(slug: string): Promise<void> {
  const revalidateUrl = new URL(
    `/api/revalidate`,
    config.nextjs.siteUrl
  );
  revalidateUrl.searchParams.set("secret", config.nextjs.revalidateSecret);
  revalidateUrl.searchParams.set("slug", slug);

  const res = await fetch(revalidateUrl.toString(), { method: "POST" });
  if (!res.ok) {
    throw new Error(`Revalidation returned ${res.status}`);
  }
  logger.info("ISR revalidation triggered", { slug });
}

// DRY_RUN: write the compiled article to disk as a standalone HTML preview
// instead of publishing to WordPress.
async function publishToDisk(article: CompiledArticle): Promise<PublishResult> {
  const outputDir = path.resolve(process.cwd(), "output");
  await mkdir(outputDir, { recursive: true });

  const filePath = path.join(outputDir, `${article.slug}.html`);
  const page = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${article.title}</title>
<meta name="description" content="${article.metaDescription}">
<style>
  body { font-family: system-ui, sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; line-height: 1.65; color: #1a1a1a; }
  h1 { font-size: 2rem; } h2 { margin-top: 2rem; } figure { margin: 1.5rem 0; }
  figcaption { color: #666; font-size: .9rem; text-align: center; }
  table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #ddd; padding: .5rem; }
  .cta-block { background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 1.5rem; text-align: center; }
  .meta { color: #888; font-size: .85rem; border-bottom: 1px solid #eee; padding-bottom: 1rem; }
</style>
</head>
<body>
<p class="meta">[DRY RUN PREVIEW] slug: ${article.slug} · ~${article.wordCount} слов · категории: ${article.categories.join(", ")}</p>
<h1>${article.title}</h1>
${article.content}
</body>
</html>`;

  await writeFile(filePath, page, "utf-8");
  logger.info("[DRY RUN] Article written to disk", { filePath });

  return {
    id: 0,
    url: `file://${filePath}`,
    slug: article.slug,
  };
}
