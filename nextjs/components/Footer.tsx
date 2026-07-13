const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Кибер СЕО";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-12">
      <div className="container mx-auto px-4 max-w-5xl py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
        <p>
          © {year} {SITE_NAME}. Все права защищены.
        </p>
        <nav className="flex gap-4" aria-label="Навигация подвала">
          <a href="/sitemap.xml" className="hover:text-gray-700">
            Sitemap
          </a>
          <a href="/robots.txt" className="hover:text-gray-700">
            Robots
          </a>
        </nav>
      </div>
    </footer>
  );
}
