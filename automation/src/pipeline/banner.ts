import sharp from "sharp";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const BANNER_WIDTH = 1920;
const BANNER_HEIGHT = 480;
const PHOTOS_COUNT = 4; // how many photos to stitch together

interface WpMedia {
  id: number;
  source_url: string;
  media_details: { width: number; height: number };
}

function wpAuthHeader(): string {
  const credentials = `${config.wordpress.username}:${config.wordpress.appPassword}`;
  return "Basic " + Buffer.from(credentials).toString("base64");
}

// Fetch random photos from the WP media library
async function fetchMediaPhotos(): Promise<WpMedia[]> {
  const res = await fetch(
    `${config.wordpress.apiUrl}/media?media_type=image&per_page=50&orderby=date&order=desc`,
    { headers: { Authorization: wpAuthHeader() } }
  );
  if (!res.ok) throw new Error(`Failed to fetch media: ${res.status}`);
  const all = (await res.json()) as WpMedia[];

  // Keep only reasonably sized images (at least 400×300)
  const suitable = all.filter(
    (m) =>
      m.media_details?.width >= 400 &&
      m.media_details?.height >= 300 &&
      m.source_url
  );

  if (suitable.length === 0) throw new Error("No suitable images in media library");

  // Shuffle and pick PHOTOS_COUNT
  const shuffled = suitable.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(PHOTOS_COUNT, shuffled.length));
}

// Download image bytes
async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Create a wide horizontal collage from WP media photos
export async function createBannerFromMedia(): Promise<Buffer> {
  const photos = await fetchMediaPhotos();
  const sliceWidth = Math.floor(BANNER_WIDTH / photos.length);

  logger.info("Creating banner collage", {
    photoCount: photos.length,
    sliceWidth,
    bannerSize: `${BANNER_WIDTH}x${BANNER_HEIGHT}`,
  });

  // Resize each photo to its slice dimensions
  const slices = await Promise.all(
    photos.map(async (photo, i) => {
      const imgBuf = await downloadImage(photo.source_url);
      // Last slice takes remaining width to avoid gaps
      const w = i === photos.length - 1 ? BANNER_WIDTH - sliceWidth * i : sliceWidth;
      return sharp(imgBuf)
        .resize(w, BANNER_HEIGHT, { fit: "cover", position: "centre" })
        .toBuffer();
    })
  );

  // Compose all slices side by side on a single canvas
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
