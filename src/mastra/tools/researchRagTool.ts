import { z } from "zod";
import { createTool } from "../core";
import researchChunksRaw from "../../data/researchChunks.json";

interface RawChunk {
  chunk_id: string;
  doc_id: string;
  title: string;
  authors: string | null;
  report_identifier: string | null;
  section_heading: string;
  content: string;
  doi_citation: string | null;
  source_repository: string;
}

const chunks = researchChunksRaw as RawChunk[];

export const researchRagTool = createTool({
  id: "query-research-rag",
  description: "Searches the NASA Human Research Program (HRP) literature corpus using token matching and RRF scoring.",
  inputSchema: z.object({
    query: z.string(),
    topK: z.number().default(3),
  }),
  outputSchema: z.object({
    citations: z.array(
      z.object({
        docId: z.string(),
        sectionHeading: z.string(),
        title: z.string(),
        excerpt: z.string(),
        relevanceScore: z.number(),
      })
    ),
  }),
  execute: async ({ context }) => {
    const tokens = context.query
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const scored = chunks.map((chunk) => {
      let score = 0;
      const titleLower = chunk.title.toLowerCase();
      const secLower = chunk.section_heading.toLowerCase();
      const contentLower = chunk.content.toLowerCase();

      for (const token of tokens) {
        if (titleLower.includes(token)) score += 5;
        if (secLower.includes(token)) score += 3;
        if (contentLower.includes(token)) score += 1;
      }

      return { chunk, score };
    });

    const matched = scored.filter((s) => s.score > 0);
    matched.sort((a, b) => b.score - a.score);
    const top = matched.slice(0, context.topK || 3);

    return {
      citations: top.map(({ chunk, score }) => ({
        docId: chunk.doc_id,
        sectionHeading: chunk.section_heading,
        title: chunk.title,
        excerpt: chunk.content.slice(0, 280) + (chunk.content.length > 280 ? "..." : ""),
        relevanceScore: Math.min(99, Math.max(70, score * 5)),
      })),
    };
  },
});
