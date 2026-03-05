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

  const description = post.frontmatter.description || post.frontmatter.subtitle || post.frontmatter.title;
  const url = `https://trypillar.com/blog/${slug}`;

  return {
    title: `${post.frontmatter.title} | Pillar Blog`,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: post.frontmatter.title,
      description,
      url,
      type: 'article',
      publishedTime: post.frontmatter.date,
      ...(post.frontmatter.author && { authors: [post.frontmatter.author] }),
      ...(post.frontmatter.image && {
        images: [{ url: post.frontmatter.image }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.frontmatter.title,
      description,
      ...(post.frontmatter.image && {
        images: [post.frontmatter.image],
      }),
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const allPosts = getAllBlogPosts();
  const post = allPosts.find((p) => p.slug === slug) ?? null;

  if (!post) {
    notFound();
  }

  const relatedPosts = allPosts.filter((p) => p.slug !== slug).slice(0, 3);

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.frontmatter.title,
    description: post.frontmatter.description || post.frontmatter.subtitle || post.frontmatter.title,
    datePublished: post.frontmatter.date,
    url: `https://trypillar.com/blog/${slug}`,
    ...(post.frontmatter.author && {
      author: {
        '@type': 'Person',
        name: post.frontmatter.author,
      },
    }),
    ...(post.frontmatter.image && {
      image: post.frontmatter.image,
    }),
    publisher: {
      '@type': 'Organization',
      name: 'Pillar',
      url: 'https://trypillar.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://trypillar.com/pillar-logo.png',
      },
    },
  };

  return (
    <article className="max-w-3xl mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
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

      <div className="prose dark:prose-invert max-w-none prose-headings:font-serif prose-headings:tracking-tight prose-a:text-primary hover:prose-a:underline">
        <MarkdownRenderer content={post.content} />
      </div>

      <div className="mt-14 pt-10 border-t border-border">
        <section className="space-y-10">
          <div className="rounded-2xl border border-border bg-muted/30 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-foreground font-serif">
              Keep exploring
            </h2>
            <p className="mt-2 text-muted-foreground">
              Want a better feel for Pillar? Here are a few good next clicks.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row flex-wrap gap-3">
              <Link
                href="/blog/our-story"
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Our story
              </Link>
              <Link
                href="/tools/agent-score"
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Agent tool score
              </Link>
              <Link
                href="/demos/grafana"
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Watch the Grafana demo
              </Link>
              <Link
                href="/docs/get-started/what-is-pillar"
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Read the docs
              </Link>
            </div>
          </div>

          {relatedPosts.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-foreground font-serif">
                Related posts
              </h2>
              <div className="mt-4 grid gap-4">
                {relatedPosts.map((p) => {
                  const description =
                    p.frontmatter.description ||
                    p.frontmatter.subtitle ||
                    p.frontmatter.title;

                  return (
                    <Link
                      key={p.slug}
                      href={`/blog/${p.slug}`}
                      className="group rounded-xl border border-border bg-background p-5 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="text-base font-semibold text-foreground">
                          {p.frontmatter.title}
                        </h3>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(parseISO(p.frontmatter.date), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {description}
                      </p>
                      <div className="mt-3 text-sm font-medium text-primary">
                        Read →
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
