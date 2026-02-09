import { getBlogPostBySlug, getAllBlogPosts } from '@/lib/blog-content';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { format, parseISO } from 'date-fns';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllBlogPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return { title: 'Not Found | Pillar Blog' };
  }

  return {
    title: `${post.frontmatter.title} | Pillar Blog`,
    description: post.frontmatter.description || post.frontmatter.subtitle,
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="max-w-3xl mx-auto">
      <div className="mb-8">
        <Link 
          href="/blog"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Blog
        </Link>
        
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl font-serif">
            {post.frontmatter.title}
          </h1>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <time dateTime={post.frontmatter.date}>
              {format(parseISO(post.frontmatter.date), 'MMMM d, yyyy')}
            </time>
            {post.frontmatter.author && (
              <>
                <span>•</span>
                <span>{post.frontmatter.author}</span>
              </>
            )}
          </div>

          {post.frontmatter.subtitle && (
            <p className="text-xl text-muted-foreground leading-relaxed">
              {post.frontmatter.subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="prose prose-lg dark:prose-invert mx-auto max-w-none prose-headings:font-serif prose-headings:font-bold prose-a:text-primary hover:prose-a:underline">
        <MarkdownRenderer content={post.content} />
      </div>
    </article>
  );
}
