import { getAllBlogPosts } from '@/lib/blog-content';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';

export const metadata = {
  title: 'Blog | Pillar',
  description: 'Thoughts on the future of product, AI, and support.',
  openGraph: {
    title: 'Blog | Pillar',
    description: 'Thoughts on the future of product, AI, and support.',
    url: 'https://trypillar.com/blog',
  },
};

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl mb-4 font-serif">
          Blog
        </h1>
        <p className="text-xl text-muted-foreground">
          Thoughts on the future of product, AI, and support.
        </p>
      </header>

      <div className="divide-y divide-border">
        {posts.map((post) => (
          <article key={post.slug} className="group relative flex flex-col gap-2 py-10 first:pt-0 last:pb-0">
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
            
            <Link href={`/blog/${post.slug}`} className="block group-hover:opacity-80 transition-opacity">
              <h2 className="text-2xl font-bold text-foreground font-serif">
                {post.frontmatter.title}
              </h2>
            </Link>

            {post.frontmatter.subtitle && (
              <p className="text-lg text-muted-foreground">
                {post.frontmatter.subtitle}
              </p>
            )}

            <div className="mt-2">
              <Link 
                href={`/blog/${post.slug}`}
                className="text-sm font-medium text-primary hover:underline underline-offset-4"
              >
                Read more →
              </Link>
            </div>
          </article>
        ))}

        {posts.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            No posts found.
          </div>
        )}
      </div>

      <nav className="mt-16 pt-8 border-t border-border">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">Start here</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/blog/our-story" className="text-sm text-foreground hover:text-primary transition-colors">
            Our story
          </Link>
          <Link href="/tools/agent-score" className="text-sm text-foreground hover:text-primary transition-colors">
            Agent tool score
          </Link>
          <Link href="/demos/grafana" className="text-sm text-foreground hover:text-primary transition-colors">
            Grafana demo
          </Link>
          <Link href="/docs/overview/introduction" className="text-sm text-foreground hover:text-primary transition-colors">
            Docs
          </Link>
        </div>
      </nav>
    </div>
  );
}
