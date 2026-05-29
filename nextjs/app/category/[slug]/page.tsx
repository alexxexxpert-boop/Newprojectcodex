import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategories, getCategoryBySlug, getPostsByCategory } from "@/lib/wordpress";
import { ArticleCard } from "@/components/ArticleCard";
import { Breadcrumb } from "@/components/Breadcrumb";

export const revalidate = 3600;

interface Params {
  params: { slug: string };
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((cat) => ({ slug: cat.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const category = await getCategoryBySlug(params.slug);
  if (!category) return {};
  return {
    title: category.name,
    description:
      category.description || `Статьи в категории "${category.name}"`,
  };
}

export default async function CategoryPage({ params }: Params) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) notFound();

  const posts = await getPostsByCategory(category.id);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Главная", href: "/" },
          { label: category.name },
        ]}
      />

      <section className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {category.name}
        </h1>
        {category.description && (
          <p className="text-gray-500">{category.description}</p>
        )}
        <p className="text-sm text-gray-400 mt-1">
          {category.count} {pluralPosts(category.count)}
        </p>
      </section>

      {posts.length === 0 ? (
        <p className="text-gray-500">Статьи в этой категории ещё не опубликованы.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <ArticleCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </>
  );
}

function pluralPosts(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "статья";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "статьи";
  return "статей";
}
