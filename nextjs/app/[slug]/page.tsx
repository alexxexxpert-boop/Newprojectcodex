import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPost, getAllPostSlugs } from "@/lib/wordpress";
import { Article } from "@/components/Article";
import { Schema } from "@/components/Schema";
import { Breadcrumb } from "@/components/Breadcrumb";
import { buildArticleSchema, buildBreadcrumbSchema } from "@/lib/schemas";

export const revalidate = 60;

interface Params {
  params: { slug: string };
}

export async function generateStaticParams() {
  try {
    const slugs = await getAllPostSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    // WordPress unreachable at build time — pages generate on-demand via ISR
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return {};

  const yoast = post.yoast_head_json;
  const title = yoast?.title ?? post.title.rendered;
  const description =
    yoast?.description ??
    post.excerpt.rendered.replace(/<[^>]+>/g, "").trim();
  const ogImage = yoast?.og_image?.[0]?.url ?? post.featured_image_url ?? "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.modified,
      images: ogImage ? [{ url: ogImage }] : [],
    },
    alternates: {
      canonical: `${siteUrl}/${post.slug}`,
    },
  };
}

export default async function PostPage({ params }: Params) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
  const articleSchema = buildArticleSchema(post);
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Главная", url: siteUrl },
    { name: post.title.rendered },
  ]);

  return (
    <>
      <Schema schemas={[articleSchema, breadcrumbSchema]} />
      <Breadcrumb
        items={[
          { label: "Главная", href: "/" },
          { label: post.title.rendered },
        ]}
      />
      <Article post={post} />
    </>
  );
}
