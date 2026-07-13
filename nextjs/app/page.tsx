import type { Metadata } from "next";
import { getPosts, getCategories } from "@/lib/wordpress";
import { ArticleCard } from "@/components/ArticleCard";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Главная",
  description: "Последние статьи об SEO и GEO оптимизации",
};

export default async function HomePage() {
  const [posts, categories] = await Promise.all([
    getPosts({ per_page: 12 }).catch(() => []),
    getCategories().catch(() => []),
  ]);

  return (
    <>
      <section className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          SEO & GEO Блог
        </h1>
        <p className="text-gray-500 text-lg">
          Экспертные статьи о поисковой оптимизации для России и СНГ
        </p>
      </section>

      {categories.length > 0 && (
        <nav className="mb-8 flex flex-wrap gap-2" aria-label="Категории">
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm hover:bg-brand-50 hover:text-brand-600 transition-colors"
            >
              {cat.name}
            </a>
          ))}
        </nav>
      )}

      {posts.length === 0 ? (
        <p className="text-gray-500">Статьи ещё не опубликованы.</p>
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
