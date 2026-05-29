export function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

  const content = `User-agent: *
Allow: /

Disallow: /api/
Disallow: /_next/

Sitemap: ${siteUrl}/sitemap.xml
`;

  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
