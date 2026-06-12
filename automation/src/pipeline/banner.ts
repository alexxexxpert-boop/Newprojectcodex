import sharp from "sharp";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const BANNER_WIDTH = 1920;
const BANNER_HEIGHT = 480;
const PHOTOS_COUNT = 4;
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

  return all.filter(
    (m) =>
      m.media_details?.width >= 400 &&
      m.media_details?.height >= 300 &&
      m.source_url
  );
}

// Pick PHOTOS_COUNT photos avoiding recently used ones.
// Once all photos are exhausted the used list resets.
async function pickPhotos(): Promise<WpMedia[]> {
  const all = await fetchAllMediaPhotos();
  if (all.length === 0) throw new Error("No suitable images in media library");

  const usedIds = await loadUsedIds();

  // Prefer photos not recently used
  let available = all.filter((m) => !usedIds.includes(m.id));

  // If not enough fresh photos, reset used list
  if (available.length < PHOTOS_COUNT) {
    logger.info("All media photos cycled — resetting rotation");
    await saveUsedIds([]);
    available = all;
  }

  // Shuffle available pool and pick
  const shuffled = available.sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, PHOTOS_COUNT);

  // Mark picked as used
  const newUsedIds = [...usedIds, ...picked.map((m) => m.id)];
  await saveUsedIds(newUsedIds);

  logger.info("Photos picked for banner", {
    picked: picked.length,
    availableBefore: available.length,
    totalInLibrary: all.length,
  });

  return picked;
}

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function createBannerFromMedia(): Promise<Buffer> {
  const photos = await pickPhotos();
  const sliceWidth = Math.floor(BANNER_WIDTH / photos.length);

  logger.info("Creating banner collage", {
    photoCount: photos.length,
    bannerSize: `${BANNER_WIDTH}x${BANNER_HEIGHT}`,
  });

  const slices = await Promise.all(
    photos.map(async (photo, i) => {
      const imgBuf = await downloadImage(photo.source_url);
      const w = i === photos.length - 1 ? BANNER_WIDTH - sliceWidth * i : sliceWidth;
      return sharp(imgBuf)
        .resize(w, BANNER_HEIGHT, { fit: "cover", position: "centre" })
        .toBuffer();
    })
  );

  const compositeInput = slices.map((buf, i) => ({
    input: buf,
    left: i * sliceWidth,
    top: 0,
  }));

  const banner = await sharp({
    create: {
      width: BANNER_WIDTH,
      height: BANNER_HEIGHT,
      channels: 3,
      background: { r: 30, g: 30, b: 30 },
    },
  })
    .composite(compositeInput)
    .jpeg({ quality: 85 })
    .toBuffer();

  logger.info("Banner collage created", { bytes: banner.length });
  return banner;
}
