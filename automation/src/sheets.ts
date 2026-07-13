import { google } from "googleapis";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

const auth = new google.auth.JWT({
  email: config.googleSheets.serviceAccountEmail,
  key: config.googleSheets.privateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = config.googleSheets.spreadsheetId;

export interface QueuedKeyword {
  rowIndex: number; // 1-based sheet row
  keyword: string;
  domain: string;
  publishDate: string;
  priority: string;
  notes: string;
}

export interface PublishedRecord {
  keyword: string;
  articleUrl: string;
  publishDate: string;
  seoScore: number;
  wordCount: number;
  status: string;
}

// Columns: A=Keyword B=Status C=Domain D=PublishDate E=Priority F=Notes
export async function getQueuedKeywords(): Promise<QueuedKeyword[]> {
  const range = `${config.googleSheets.queueSheet}!A2:F`;
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = response.data.values ?? [];

  const queued: QueuedKeyword[] = [];
  rows.forEach((row, idx) => {
    const status = (row[1] as string | undefined)?.toLowerCase() ?? "pending";
    if (status === "pending" && row[0]) {
      queued.push({
        rowIndex: idx + 2, // +2 because 1-based and we skip header
        keyword: String(row[0]),
        domain: String(row[2] ?? ""),
        publishDate: String(row[3] ?? ""),
        priority: String(row[4] ?? "normal"),
        notes: String(row[5] ?? ""),
      });
    }
  });

  return queued;
}

// Status column is B (index 2, A1 notation)
export async function updateStatus(
  rowIndex: number,
  status: string
): Promise<void> {
  const range = `${config.googleSheets.queueSheet}!B${rowIndex}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [[status]] },
  });
  logger.info("Updated queue status", { rowIndex, status });
}

// Columns: A=Keyword B=URL C=PublishDate D=SEOScore E=WordCount F=Status
export async function addPublishedRecord(record: PublishedRecord): Promise<void> {
  const range = `${config.googleSheets.publishedSheet}!A:F`;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          record.keyword,
          record.articleUrl,
          record.publishDate,
          record.seoScore,
          record.wordCount,
          record.status,
        ],
      ],
    },
  });
  logger.info("Added published record to sheets", { keyword: record.keyword });
}
