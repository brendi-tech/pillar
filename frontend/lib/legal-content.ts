/**
 * Legal Content Loader
 * Utilities for loading and parsing legal markdown content at build time.
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const LEGAL_DIR = path.join(process.cwd(), 'content', 'legal');

export interface LegalFrontmatter {
  title: string;
  lastUpdated: string;
}

export interface LegalDocument {
  slug: string;
  frontmatter: LegalFrontmatter;
  content: string;
}

/**
 * Get a legal document by slug (e.g., 'terms' or 'privacy')
 */
export function getLegalDocument(slug: string): LegalDocument | null {
  const filePath = path.join(LEGAL_DIR, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(fileContents);

    // gray-matter parses YAML dates as Date objects, but we need strings for React rendering
    const lastUpdated = data.lastUpdated instanceof Date
      ? data.lastUpdated.toISOString().split('T')[0]
      : String(data.lastUpdated);

    return {
      slug,
      frontmatter: {
        title: data.title,
        lastUpdated,
      },
      content,
    };
  } catch (error) {
    console.error(`Error parsing legal file ${filePath}:`, error);
    return null;
  }
}
