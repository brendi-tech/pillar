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
      siteName: 'Pillar',
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
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

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

      <div className="prose prose-lg dark:prose-invert mx-auto max-w-none prose-headings:font-serif prose-headings:font-bold prose-a:text-primary hover:prose-a:underline">
        <MarkdownRenderer content={post.content} />
      </div>
    </article>
  );
}
