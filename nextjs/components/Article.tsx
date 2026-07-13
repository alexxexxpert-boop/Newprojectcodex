import Image from "next/image";
import type { WpPost } from "@/types/wordpress";

interface ArticleProps {
  post: WpPost;
}

export function Article({ post }: ArticleProps) {
  const title = post.title.rendered;
  const date = new Date(post.date).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const modified = new Date(post.modified).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article itemScope itemType="https://schema.org/BlogPosting">
      <header className="mb-8">
        <h1
          className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4"
          itemProp="headline"
          dangerouslySetInnerHTML={{ __html: title }}
        />
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <time
            dateTime={post.date}
            itemProp="datePublished"
          >
            {date}
          </time>
          {post.modified !== post.date && (
            <span>
              Обновлено:{" "}
              <time dateTime={post.modified} itemProp="dateModified">
                {modified}
              </time>
            </span>
          )}
          {post.reading_time > 0 && (
            <span>{post.reading_time} мин чтения</span>
          )}
        </div>
      </header>

      {post.featured_image_url && (
        <figure className="mb-8 rounded-xl overflow-hidden aspect-video relative bg-gray-100">
          <Image
            src={post.featured_image_url}
            alt={title}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 1024px) 100vw, 800px"
            itemProp="image"
          />
        </figure>
      )}

      <div
        className="prose prose-gray prose-lg max-w-none
          prose-headings:font-bold prose-headings:text-gray-900
          prose-a:text-brand-600 prose-a:no-underline hover:prose-a:underline
          prose-img:rounded-lg prose-img:shadow-sm
          prose-table:text-sm
          prose-code:text-brand-600 prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded"
        itemProp="articleBody"
        dangerouslySetInnerHTML={{ __html: post.content.rendered }}
      />
    </article>
  );
}
