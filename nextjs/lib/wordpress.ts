import type { WpPost, WpCategory } from "@/types/wordpress";

const WP_API_URL =
  process.env.WP_API_URL ?? "https://api.example.com/wp-json/wp/v2";

const DEFAULT_POST_FIELDS =
  "id,slug,date,modified,title,excerpt,featured_image_url,reading_time,yoast_head_json,categories,tags";

async function wpFetch<T>(
  path: string,
  params: Record<string, string | number> = {},
  revalidate: number | false = 3600
): Promise<T> {
  const url = new URL(`${WP_API_URL}${path}`);
  Object.entries(params).forEach(([k, v]) =>
    url.searchParams.set(k, String(v))
  );

  const res = await fetch(url.toString(), {
    next: revalidate === false ? { revalidate: 0 } : { revalidate },
  });

  if (!res.ok) {
    throw new Error(`WordPress API error ${res.status}: ${url.toString()}`);
  }

  return res.json() as Promise<T>;
}

export async function getPosts(
  params: Record<string, string | number> = {}
): Promise<WpPost[]> {
  return wpFetch<WpPost[]>("/posts", {
    per_page: 12,
    _fields: DEFAULT_POST_FIELDS,
    ...params,
  });
}

export async function getPost(slug: string): Promise<WpPost | null> {
  const posts = await wpFetch<WpPost[]>(
    "/posts",
    {
      slug,
      _fields: `${DEFAULT_POST_FIELDS},content`,
      _embed: "wp:featuredmedia,wp:term",
    },
    60
  );
  return posts[0] ?? null;
}

export async function getPostsByCategory(
  categoryId: number,
  params: Record<string, string | number> = {}
): Promise<WpPost[]> {
  return wpFetch<WpPost[]>("/posts", {
    categories: categoryId,
    per_page: 12,
    _fields: DEFAULT_POST_FIELDS,
    ...params,
  });
}

export async function getCategories(): Promise<WpCategory[]> {
  return wpFetch<WpCategory[]>(
    "/categories",
    { per_page: 50, hide_empty: 1 },
    86400
  );
}

export async function getCategoryBySlug(
  slug: string
): Promise<WpCategory | null> {
  const cats = await wpFetch<WpCategory[]>(
    "/categories",
    { slug, per_page: 1 },
    86400
  );
  return cats[0] ?? null;
}

export async function getAllPostSlugs(): Promise<string[]> {
  const posts = await wpFetch<{ slug: string }[]>("/posts", {
    per_page: 100,
    _fields: "slug",
  });
  return posts.map((p) => p.slug);
}
