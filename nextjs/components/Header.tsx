import Link from "next/link";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Кибер СЕО";

export function Header() {
  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
      <div className="container mx-auto px-4 max-w-5xl">
        <nav
          className="flex items-center justify-between h-14"
          aria-label="Главная навигация"
        >
          <Link
            href="/"
            className="font-bold text-xl text-brand-600 hover:text-brand-900 transition-colors"
          >
            {SITE_NAME}
          </Link>
          <ul className="flex gap-6 text-sm font-medium text-gray-600">
            <li>
              <Link href="/" className="hover:text-brand-600 transition-colors">
                Блог
              </Link>
            </li>
            <li>
              <Link
                href="/category/seo"
                className="hover:text-brand-600 transition-colors"
              >
                SEO
              </Link>
            </li>
            <li>
              <Link
                href="/category/geo"
                className="hover:text-brand-600 transition-colors"
              >
                GEO
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
