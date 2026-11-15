/**
 * SpaceLife Library Tool for SpaceCare AI.
 *
 * Retrieves verified NASA Human Research Program guides, official video streams,
 * and instructional procedures from officialNasaGuides.json.
 */

import { z } from "zod";
import { createTool } from "../core/index.ts";
import officialNasaGuidesRaw from "../../data/officialNasaGuides.json" with { type: "json" };
import type { LibraryGuide } from "../../types/library";
import type { SpaceCareResourceReference } from "../../types/api";

const officialGuides = officialNasaGuidesRaw as LibraryGuide[];

export function mapGuideToSpaceCareResource(guide: LibraryGuide): SpaceCareResourceReference {
  return {
    id: guide.id,
    title: guide.title,
    category: guide.category,
    contentType: guide.mediaType === "youtube" ? "video" : "video",
    description: guide.summary,
    mediaUrl: guide.mediaUrl,
    thumbnailUrl: guide.thumbnailUrl,
    durationMinutes: guide.durationMinutes,
    chapters: guide.chapters.map((c) => ({
      time: c.time,
      seconds: c.seconds,
      title: c.title,
    })),
    instructions: guide.instructions,
    sourceName: guide.sourceRepository,
    sourceDocId: guide.nasaDocumentId,
    safetyNotices: guide.safetyNotices.map((s) => ({
      level: s.level,
      text: s.text,
    })),
  };
}

export function searchSpaceLifeGuides(options: {
  query?: string;
  category?: string;
  symptomCodes?: string[];
  limit?: number;
}): SpaceCareResourceReference[] {
  const { query = "", category, symptomCodes = [], limit = 3 } = options;
  const cleanQ = query.trim().toLowerCase();

  // If query is just a generic greeting or empty, and no symptom/category filter is set, return empty
  const isGenericGreeting = /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|test)$/i.test(cleanQ);
  if ((isGenericGreeting || !cleanQ) && !category && symptomCodes.length === 0) {
    return [];
  }

  const qTokens = cleanQ
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (qTokens.length === 0 && !category && symptomCodes.length === 0) {
    return [];
  }

  const scored = officialGuides.map((guide) => {
    let score = 0;

    // Category match
    if (category && category !== "all" && guide.category === category) {
      score += 20;
    }

    // Symptom code match
    if (guide.relatedSymptomCodes && symptomCodes.length > 0) {
      for (const code of symptomCodes) {
        if (guide.relatedSymptomCodes.includes(code.toUpperCase())) {
          score += 30;
        }
      }
    }

    // Keyword tokens
    const textBlob = `${guide.title} ${guide.summary} ${guide.instructions.join(" ")} ${guide.nasaDocumentId}`.toLowerCase();
    for (const token of qTokens) {
      if (guide.title.toLowerCase().includes(token)) {
        score += 15;
      } else if (textBlob.includes(token)) {
        score += 8;
      }
    }

    return { guide, score };
  });

  const MIN_SCORE_THRESHOLD = 20;

  const relevantMatches = scored
    .filter((item) => item.score >= MIN_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (relevantMatches.length === 0) {
    return [];
  }

  return relevantMatches.slice(0, limit).map((s) => mapGuideToSpaceCareResource(s.guide));
}

export const spaceLifeLibraryTool = createTool({
  id: "query-spacelife-library",
  description:
    "Searches the certified SpaceLife Library for astronaut health guides, exercise instructions, sleep habitability protocols, and official NASA video streams.",
  inputSchema: z.object({
    query: z.string().optional(),
    category: z.string().optional(),
    symptomCodes: z.array(z.string()).optional(),
    limit: z.number().default(3),
  }),
  outputSchema: z.object({
    resources: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        category: z.enum(["exercise", "sleep", "medical", "nutrition", "adaptation"]),
        contentType: z.string(),
        description: z.string(),
        mediaUrl: z.string(),
        thumbnailUrl: z.string().optional(),
        durationMinutes: z.number().optional(),
        chapters: z
          .array(
            z.object({
              time: z.string(),
              seconds: z.number(),
              title: z.string(),
            })
          )
          .optional(),
        instructions: z.array(z.string()).optional(),
        sourceName: z.string(),
        sourceDocId: z.string(),
        safetyNotices: z
          .array(
            z.object({
              level: z.string(),
              text: z.string(),
            })
          )
          .optional(),
      })
    ),
  }),
  execute: async ({ context }) => {
    const resources = searchSpaceLifeGuides({
      query: context.query,
      category: context.category,
      symptomCodes: context.symptomCodes,
      limit: context.limit,
    });
    return { resources };
  },
});
