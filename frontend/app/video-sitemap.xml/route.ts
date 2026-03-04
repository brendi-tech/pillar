import { NextResponse } from "next/server";
import {
  VIDEO_DEMOS,
  type DemoSlug,
} from "@/app/marketing/demos/[demo]/demos.data";
import { fetchYouTubeVideos, getVideoSlug } from "@/lib/youtube";

export const revalidate = 86400;

const BASE_URL = "https://trypillar.com";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const demoEntries = (Object.entries(VIDEO_DEMOS) as [DemoSlug, (typeof VIDEO_DEMOS)[DemoSlug]][]).map(
    ([slug, data]) => {
      const tags = data.tags
        .map((tag) => `      <video:tag>${escapeXml(tag)}</video:tag>`)
        .join("\n");

      return `  <url>
    <loc>${BASE_URL}/demos/${slug}</loc>
    <video:video>
      <video:thumbnail_loc>${BASE_URL}${data.thumbnail}</video:thumbnail_loc>
      <video:title>${escapeXml(data.title)}</video:title>
      <video:description>${escapeXml(`"${data.prompt}" — ${data.description}`)}</video:description>
      <video:content_loc>${BASE_URL}${data.mp4}</video:content_loc>
      <video:player_loc>${BASE_URL}/demos/${slug}</video:player_loc>
      <video:duration>${data.durationSec}</video:duration>
      <video:publication_date>${data.uploadDate}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
${tags}
    </video:video>
  </url>`;
    },
  );

  const youtubeVideos = await fetchYouTubeVideos();
  const youtubeEntries = youtubeVideos.map((video) => {
    const slug = getVideoSlug(video);
    const description = video.description.slice(0, 2048);
    const ytTags = video.tags
      .slice(0, 10)
      .map((tag) => `      <video:tag>${escapeXml(tag)}</video:tag>`)
      .join("\n");

    return `  <url>
    <loc>${BASE_URL}/resources/videos/${escapeXml(slug)}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(video.thumbnailHigh)}</video:thumbnail_loc>
      <video:title>${escapeXml(video.title)}</video:title>
      <video:description>${escapeXml(description)}</video:description>
      <video:player_loc>https://www.youtube.com/embed/${video.videoId}</video:player_loc>
      <video:duration>${video.durationSec}</video:duration>
      <video:view_count>${video.viewCount}</video:view_count>
      <video:publication_date>${video.publishedAt.split("T")[0]}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
${ytTags}
    </video:video>
  </url>`;
  });

  const allEntries = [...demoEntries, ...youtubeEntries];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${allEntries.join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
