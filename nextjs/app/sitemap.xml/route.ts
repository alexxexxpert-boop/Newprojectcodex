import { getPosts, getCategories } from "@/lib/wordpress";

export const revalidate = 3600;

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

  const [posts, categories] = await Promise.all([
    getPosts({ per_page: 100, _fields: "slug,modified" }).catch(() => []),
    getCategories().catch(() => []),
  ]);

  const staticUrls = [
    { loc: siteUrl, lastmod: new Date().toISOString(), priority: "1.0", changefreq: "daily" },
  ];

  const categoryUrls = categories.map((cat) => ({
    loc: `${siteUrl}/category/${cat.slug}`,
    lastmod: new Date().toISOString(),
    priority: "0.6",
    changefreq: "weekly",
  }));

  const postUrls = posts.map((post) => ({
    loc: `${siteUrl}/${post.slug}`,
    lastmod: post.modified,
    priority: "0.8",
    changefreq: "weekly",
  }));

  const allUrls = [...staticUrls, ...categoryUrls, ...postUrls];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
