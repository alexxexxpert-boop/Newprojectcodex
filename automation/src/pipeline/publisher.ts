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
