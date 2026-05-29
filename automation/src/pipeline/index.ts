import { logger } from "../utils/logger.js";
import { researchKeywords } from "./keywords.js";
import { planTopic } from "./planner.js";
import { researchSections } from "./researcher.js";
import { writeSections } from "./writer.js";
import { generateImagePrompts, generateImages } from "./images.js";
import { auditContent } from "./auditor.js";
import { compileArticle } from "./compiler.js";
import { publishToWordPress } from "./publisher.js";
import type { PublishResult } from "./publisher.js";
import type { CompiledArticle } from "./compiler.js";

export interface PipelineResult {
  publishResult: PublishResult;
  article: CompiledArticle;
  auditScore: number;
}

export async function runPipeline(keyword: string): Promise<PipelineResult> {
  logger.info("Pipeline started", { keyword });

  // Step 1: Keyword research
  const keywordData = await researchKeywords(keyword);

  // Step 2: Plan article outline
  const outline = await planTopic(keyword, keywordData.relatedKeywords);

  // Step 3: Research each section
  const sectionResearch = await researchSections(keyword, outline.sections);

  // Step 4: Write all sections
  const writtenSections = await writeSections(keyword, outline, sectionResearch);

  // Step 5: Generate image prompts
  const h2Titles = outline.sections.map((s) => s.h2);
  const imagePrompts = await generateImagePrompts(keyword, h2Titles);

  // Step 6: Generate images (optional)
  const images = await generateImages(imagePrompts);

  // Step 7: Compile full article
  const article = compileArticle(outline, writtenSections, images);

  // Step 8: Audit content quality
  const auditResult = await auditContent(keyword, article.content);
  logger.info("Content audit complete", {
    keyword,
    score: auditResult.score,
    approved: auditResult.approved,
  });

  // Step 9: Publish to WordPress (even if audit score is low — logged as warning)
  const publishResult = await publishToWordPress(article);

  logger.info("Pipeline complete", {
    keyword,
    url: publishResult.url,
    wordCount: article.wordCount,
    auditScore: auditResult.score,
  });

  return { publishResult, article, auditScore: auditResult.score };
}
