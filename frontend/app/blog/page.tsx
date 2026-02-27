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

      <section className="mb-12">
        <div className="rounded-2xl border border-border bg-muted/30 p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-foreground font-serif">
            Start here
          </h2>
          <p className="mt-2 text-muted-foreground">
            If you’re new to Pillar, these are the best entry points.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href="/blog/our-story"
              className="rounded-xl border border-border bg-background p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="text-sm font-semibold text-foreground">Our story</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Why we built Pillar, and what we learned building complex products.
              </div>
            </Link>
            <Link
              href="/tools/agent-score"
              className="rounded-xl border border-border bg-background p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="text-sm font-semibold text-foreground">Agent tool score</div>
              <div className="mt-1 text-sm text-muted-foreground">
                A quick scorecard to see if your product is ready for agents.
              </div>
            </Link>
            <Link
              href="/demos/grafana"
              className="rounded-xl border border-border bg-background p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="text-sm font-semibold text-foreground">Grafana demo</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Watch Pillar take actions in a real open-source UI.
              </div>
            </Link>
            <Link
              href="/docs/overview/introduction"
              className="rounded-xl border border-border bg-background p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="text-sm font-semibold text-foreground">Docs</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Install the SDK and register your first tools.
              </div>
            </Link>
          </div>
        </div>
      </section>

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

            {/* {post.frontmatter.description && (
              <p className="text-base text-muted-foreground/80 line-clamp-3">
                {post.frontmatter.description}
              </p>
            )} */}

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
    </div>
  );
}
