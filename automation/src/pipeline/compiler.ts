import type { ArticleOutline } from "./planner.js";
import type { WrittenSection } from "./writer.js";
import type { GeneratedImage } from "./images.js";

export interface CompiledArticle {
  title: string;
  content: string; // HTML
  excerpt: string;
  slug: string;
  metaDescription: string;
  categories: string[];
  tags: string[];
  wordCount: number;
}

export function compileArticle(
  outline: ArticleOutline,
  sections: WrittenSection[],
  images: GeneratedImage[]
): CompiledArticle {
  const imageMap = new Map(images.map((img) => [img.h2, img]));

  const parts: string[] = [];

  // Intro
  parts.push(`<p>${escapeHtml(outline.intro)}</p>`);

  // Sections
  for (const section of outline.sections) {
    parts.push(`<h2>${escapeHtml(section.h2)}</h2>`);

    // Featured image for section (if available)
    const img = imageMap.get(section.h2);
    if (img?.imageUrl) {
      parts.push(
        `<figure>` +
          `<img src="${escapeHtml(img.imageUrl)}" alt="${escapeHtml(img.altText)}" loading="lazy" />` +
          (img.caption ? `<figcaption>${escapeHtml(img.caption)}</figcaption>` : "") +
          `</figure>`
      );
    }

    // Section content (convert Markdown → HTML)
    const written = sections.find((s) => s.h2 === section.h2);
    if (written) {
      parts.push(markdownToHtml(written.content));
    }
  }

  // FAQ
  if (outline.faq.length > 0) {
    parts.push(`<h2>Часто задаваемые вопросы</h2>`);
    parts.push(`<dl class="faq">`);
    for (const item of outline.faq) {
      parts.push(
        `<dt>${escapeHtml(item.question)}</dt>` +
          `<dd>${escapeHtml(item.shortAnswer)}</dd>`
      );
    }
    parts.push(`</dl>`);

    // FAQ JSON-LD
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: outline.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.shortAnswer },
      })),
    };
    parts.push(
      `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>`
    );
  }

  // Conclusion + CTA
  if (outline.conclusion) {
    parts.push(`<h2>Заключение</h2><p>${escapeHtml(outline.conclusion)}</p>`);
  }
  if (outline.cta) {
    parts.push(`<div class="cta-block"><p><strong>${escapeHtml(outline.cta)}</strong></p></div>`);
  }

  const content = parts.join("\n");
  const wordCount = content.replace(/<[^>]+>/g, " ").split(/\s+/).length;

  // Derive tags from related keywords in the outline
  const tags = outline.sections
    .flatMap((s) => s.subsections.map((sub) => sub.h3))
    .slice(0, 10);

  return {
    title: outline.h1,
    content,
    excerpt: outline.intro,
    slug: outline.slug,
    metaDescription: outline.metaDescription,
    categories: ["Блог"],
    tags,
    wordCount,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Minimal Markdown → HTML converter for the subset Claude returns
function markdownToHtml(md: string): string {
  return md
    // Code blocks (before other replacements)
    .replace(/```[\s\S]*?```/g, (m) => `<pre><code>${escapeHtml(m.slice(3, -3).replace(/^[a-z]+\n/, ""))}</code></pre>`)
    // H3
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Unordered list items
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Tables (basic: | col | col |)
    .replace(/(\|.+\|\n)+/g, convertTable)
    // Paragraphs (blank-line-separated text)
    .replace(/\n\n([^<\n].+)/g, "\n\n<p>$1</p>")
    // Line breaks
    .replace(/\n/g, "\n");
}

function convertTable(tableStr: string): string {
  const rows = tableStr.trim().split("\n");
  const html: string[] = ["<table>"];
  rows.forEach((row, i) => {
    if (/^\|[-| :]+\|$/.test(row.trim())) return; // skip separator row
    const cells = row
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    const tag = i === 0 ? "th" : "td";
    html.push(`<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join("")}</tr>`);
  });
  html.push("</table>");
  return html.join("\n");
}
