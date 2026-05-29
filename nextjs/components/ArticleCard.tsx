import Link from "next/link";
import Image from "next/image";
import type { WpPost } from "@/types/wordpress";

interface ArticleCardProps {
  post: WpPost;
}

export function ArticleCard({ post }: ArticleCardProps) {
  const title = post.title.rendered;
  const excerpt = post.excerpt.rendered.replace(/<[^>]+>/g, "").trim();
  const date = new Date(post.date).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article className="flex flex-col rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {post.featured_image_url && (
        <Link href={`/${post.slug}`} className="block aspect-video relative bg-gray-100">
          <Image
            src={post.featured_image_url}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </Link>
      )}
      <div className="flex flex-col flex-1 p-5">
        <Link href={`/${post.slug}`}>
          <h2
            className="text-base font-semibold text-gray-900 hover:text-brand-600 transition-colors line-clamp-2 mb-2"
            dangerouslySetInnerHTML={{ __html: title }}
          />
        </Link>
        <p className="text-sm text-gray-500 line-clamp-3 flex-1">{excerpt}</p>
        <footer className="flex items-center justify-between mt-4 text-xs text-gray-400">
          <time dateTime={post.date}>{date}</time>
          {post.reading_time > 0 && (
            <span>{post.reading_time} мин чтения</span>
          )}
        </footer>
      </div>
    </article>
  );
}
