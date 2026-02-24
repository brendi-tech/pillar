/**
 * Docs Search API
 *
 * Client-side documentation search using Fuse.js with a build-time generated index.
 */

import Fuse from "fuse.js";
import searchIndex from "@/generated/docs-search-index.json";

export interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  source_name?: string;
  item_type?: string;
  score?: number;
}

interface DocEntry {
  id: string;
  title: string;
  description: string;
  content: string;
  url: string;
  section: string;
}

const docs = searchIndex as DocEntry[];

const fuse = new Fuse<DocEntry>(docs, {
  keys: [
    { name: "title", weight: 3 },
    { name: "description", weight: 2 },
    { name: "content", weight: 1 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
});

/**
 * Check if a document contains the search term (case-insensitive)
 */
function docContainsTerm(doc: DocEntry, term: string): boolean {
  const lowerTerm = term.toLowerCase();
  return (
    doc.title.toLowerCase().includes(lowerTerm) ||
    doc.description.toLowerCase().includes(lowerTerm) ||
    doc.content.toLowerCase().includes(lowerTerm)
  );
}

/**
 * Score a document based on where the term appears (title > description > content)
 */
function scoreMatch(doc: DocEntry, term: string): number {
  const lowerTerm = term.toLowerCase();
  let score = 1; // Start with worst score

  if (doc.title.toLowerCase().includes(lowerTerm)) {
    score = 0.1; // Best score for title match
  } else if (doc.description.toLowerCase().includes(lowerTerm)) {
    score = 0.3; // Good score for description match
  } else if (doc.content.toLowerCase().includes(lowerTerm)) {
    score = 0.5; // Okay score for content match
  }

  return score;
}

/**
 * Search docs using a hybrid approach:
 * 1. First find exact substring matches
 * 2. Then add fuzzy matches from Fuse.js
 * 3. Merge and dedupe results
 */
export async function searchDocs(
  query: string,
  topK = 10
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  // First, find exact substring matches
  const exactMatches = docs
    .filter((doc) => docContainsTerm(doc, trimmed))
    .map((doc) => ({
      item: doc,
      score: scoreMatch(doc, trimmed),
    }))
    .sort((a, b) => a.score - b.score);

  // Then get fuzzy matches from Fuse.js
  const fuzzyResults = fuse.search(trimmed, { limit: topK });

  // Merge results, prioritizing exact matches
  const seenIds = new Set<string>();
  const merged: Array<{ item: DocEntry; score: number }> = [];

  // Add exact matches first
  for (const match of exactMatches) {
    if (!seenIds.has(match.item.id)) {
      seenIds.add(match.item.id);
      merged.push(match);
    }
  }

  // Add fuzzy matches that weren't already found
  for (const result of fuzzyResults) {
    if (!seenIds.has(result.item.id)) {
      seenIds.add(result.item.id);
      merged.push({ item: result.item, score: result.score ?? 0.5 });
    }
  }

  return merged.slice(0, topK).map((result) => ({
    id: result.item.id,
    title: result.item.title,
    excerpt:
      result.item.description || result.item.content.slice(0, 150) + "...",
    url: result.item.url,
    source_name: result.item.section,
    score: result.score,
  }));
}
