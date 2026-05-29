export interface WpRendered {
  rendered: string;
}

export interface WpOgImage {
  url: string;
  width: number;
  height: number;
}

export interface WpYoastHeadJson {
  title: string;
  description: string;
  og_title: string;
  og_description: string;
  og_image: WpOgImage[];
  og_type: string;
  article_published_time?: string;
  article_modified_time?: string;
  schema?: Record<string, unknown>;
}

export interface WpPost {
  id: number;
  slug: string;
  date: string;
  modified: string;
  title: WpRendered;
  content: WpRendered;
  excerpt: WpRendered;
  featured_image_url: string | null;
  reading_time: number;
  yoast_head_json: WpYoastHeadJson | null;
  categories: number[];
  tags: number[];
  _embedded?: {
    "wp:featuredmedia"?: { source_url: string; alt_text: string }[];
    "wp:term"?: WpTerm[][];
  };
}

export interface WpCategory {
  id: number;
  slug: string;
  name: string;
  description: string;
  count: number;
  parent: number;
}

export interface WpTerm {
  id: number;
  name: string;
  slug: string;
  taxonomy: string;
}
