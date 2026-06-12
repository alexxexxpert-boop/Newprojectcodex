import sharp from "sharp";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const BANNER_WIDTH = 1920;
const BANNER_HEIGHT = 480;
const USED_IDS_FILE = path.resolve(process.cwd(), "queue/banner-used.json");

interface WpMedia {
  id: number;
  source_url: string;
  media_details: { width: number; height: number };
}

function wpAuthHeader(): string {
  const credentials = `${config.wordpress.username}:${config.wordpress.appPassword}`;
  return "Basic " + Buffer.from(credentials).toString("base64");
}

async function loadUsedIds(): Promise<number[]> {
  try {
    const raw = await readFile(USED_IDS_FILE, "utf-8");
    return JSON.parse(raw) as number[];
  } catch {
    return [];
  }
}

async function saveUsedIds(ids: number[]): Promise<void> {
  await writeFile(USED_IDS_FILE, JSON.stringify(ids), "utf-8");
}

async function fetchAllMediaPhotos(): Promise<WpMedia[]> {
  const res = await fetch(
    `${config.wordpress.apiUrl}/media?media_type=image&per_page=100&orderby=date&order=desc`,
    { headers: { Authorization: wpAuthHeader() } }
  );
  if (!res.ok) throw new Error(`Failed to fetch media: ${res.status}`);
  const all = (await res.json()) as WpMedia[];

  // Only landscape/square photos with known dimensions
  return all.filter(
    (m) =>
      m.media_details?.width >= 300 &&
      m.media_details?.height >= 200 &&
      m.source_url
  );
}

// Pick photos avoiding recently used ones, then mark them used
async function pickPhotos(needed: number): Promise<WpMedia[]> {
  const all = await fetchAllMediaPhotos();
  if (all.length === 0) throw new Error("No suitable images in media library");

  const usedIds = await loadUsedIds();
  let available = all.filter((m) => !usedIds.includes(m.id));

  if (available.length < needed) {
    logger.info("All media photos cycled — resetting rotation");
    await saveUsedIds([]);
    available = all;
  }

  const shuffled = available.sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, needed);

  await saveUsedIds([...usedIds, ...picked.map((m) => m.id)]);
  return picked;
}

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Calculate how wide each photo would be at BANNER_HEIGHT (preserving aspect ratio)
function naturalWidth(photo: WpMedia): number {
  return Math.round((photo.media_details.width / photo.media_details.height) * BANNER_HEIGHT);
}

export async function createBannerFromMedia(): Promise<Buffer> {
  const all = await fetchAllMediaPhotos();
  if (all.length === 0) throw new Error("No suitable images in media library");

  const usedIds = await loadUsedIds();
  let available = all.filter((m) => !usedIds.includes(m.id));
  if (available.length === 0) {
    await saveUsedIds([]);
    available = all;
  }

  // Shuffle pool
  const pool = available.sort(() => Math.random() - 0.5);

  // Pick photos until cumulative natural width covers BANNER_WIDTH
  const selected: WpMedia[] = [];
  let totalNaturalWidth = 0;

  for (const photo of pool) {
    selected.push(photo);
    totalNaturalWidth += naturalWidth(photo);
    if (totalNaturalWidth >= BANNER_WIDTH) break;
  }

  // Mark selected as used
  await saveUsedIds([...usedIds, ...selected.map((m) => m.id)]);

  // Scale factor so all photos together fill exactly BANNER_WIDTH
  const scale = BANNER_WIDTH / totalNaturalWidth;

  logger.info("Creating banner collage", {
    photoCount: selected.length,
    totalNaturalWidth,
    scale: scale.toFixed(3),
    bannerSize: `${BANNER_WIDTH}x${BANNER_HEIGHT}`,
  });

  // Calculate final widths (ensure they sum to exactly BANNER_WIDTH)
  const finalWidths = selected.map((p, i) => {
    if (i === selected.length - 1) {
      // Last photo fills remaining pixels
      const used = selected.slice(0, i).reduce((s, p2) => s + Math.round(naturalWidth(p2) * scale), 0);
      return BANNER_WIDTH - used;
    }
    return Math.round(naturalWidth(p) * scale);
  });

  // Download and resize each photo proportionally (no crop — fit: "fill" scales to exact size)
  const slices = await Promise.all(
    selected.map(async (photo, i) => {
      const imgBuf = await downloadImage(photo.source_url);
      return sharp(imgBuf)
        .resize(finalWidths[i], BANNER_HEIGHT, { fit: "fill" }) // fill = scale to exact, no crop
        .toBuffer();
    })
  );

  // Composite slices side by side
  let xOffset = 0;
  const compositeInput = slices.map((buf, i) => {
    const input = { input: buf, left: xOffset, top: 0 };
    xOffset += finalWidths[i]!;
    return input;
  });

  const banner = await sharp({
    create: {
      width: BANNER_WIDTH,
      height: BANNER_HEIGHT,
      channels: 3,
      background: { r: 30, g: 30, b: 30 },
    },
  })
    .composite(compositeInput)
    .jpeg({ quality: 88 })
    .toBuffer();

  logger.info("Banner collage created", {
    bytes: banner.length,
    photos: selected.map((p) => p.id),
  });

  return banner;
}
