import type { WpPost } from "@/types/wordpress";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Кибер СЕО";

export function buildArticleSchema(post: WpPost) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title.rendered,
    image: post.featured_image_url ?? undefined,
    datePublished: post.date,
    dateModified: post.modified,
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
    description:
      post.yoast_head_json?.description ??
      post.excerpt.rendered.replace(/<[^>]+>/g, "").trim(),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/${post.slug}`,
    },
  };
}

export function buildBreadcrumbSchema(
  items: { name: string; url?: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  };
}

export function buildWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/?s={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}
