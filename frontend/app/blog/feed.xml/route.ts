import { getAllBlogPosts } from "@/lib/blog-content";

const SITE_URL = "https://trypillar.com";

/**
 * RSS 2.0 feed for the Pillar blog.
 *
 * Generates an XML feed from all blog posts.
 * Auto-discoverable via <link rel="alternate"> in the root layout.
 *
 * Route: /blog/feed.xml
 */
export async function GET() {
  const posts = getAllBlogPosts();

  const items = posts
    .map((post) => {
      const pubDate = new Date(post.frontmatter.date).toUTCString();
      const description =
        post.frontmatter.description ||
        post.frontmatter.subtitle ||
        post.frontmatter.title;

      return `    <item>
      <title><![CDATA[${post.frontmatter.title}]]></title>
      <link>${SITE_URL}/blog/${post.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${post.slug}</guid>
      <description><![CDATA[${description}]]></description>
      <pubDate>${pubDate}</pubDate>${post.frontmatter.author ? `\n      <author>${post.frontmatter.author}</author>` : ""}
    </item>`;
    })
    .join("\n");

  const lastBuildDate =
    posts.length > 0
      ? new Date(posts[0].frontmatter.date).toUTCString()
      : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Pillar Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Product thinking and technical articles about building AI copilots for SaaS applications.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/blog/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml.trim(), {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
