import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { parseISO, compareDesc } from 'date-fns';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog');

export interface BlogFrontmatter {
  title: string;
  subtitle?: string;
  date: string;
  author?: string;
  slug?: string;
  description?: string;
  image?: string;
}

export interface BlogPost {
  slug: string;
  frontmatter: BlogFrontmatter;
  content: string;
}

export function getAllBlogPosts(): BlogPost[] {
  if (!fs.existsSync(CONTENT_DIR)) {
    return [];
  }

  const files = fs.readdirSync(CONTENT_DIR);
  const posts: BlogPost[] = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const source = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8');
    const { data, content } = matter(source);
    
    // Use explicit slug from frontmatter, or filename without extension
    const slug = data.slug || file.replace(/\.md$/, '');

    posts.push({
      slug,
      frontmatter: data as BlogFrontmatter,
      content,
    });
  }

  // Sort by date descending
  return posts.sort((a, b) => {
    return compareDesc(parseISO(a.frontmatter.date), parseISO(b.frontmatter.date));
  });
}

export function getBlogPostBySlug(slug: string): BlogPost | null {
  const allPosts = getAllBlogPosts();
  return allPosts.find((post) => post.slug === slug) || null;
}
