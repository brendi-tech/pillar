import { NextResponse } from "next/server";
import {
  VIDEO_DEMOS,
  type DemoSlug,
} from "@/app/marketing/demos/[demo]/page";

const BASE_URL = "https://trypillar.com";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET() {
  const entries = (Object.entries(VIDEO_DEMOS) as [DemoSlug, (typeof VIDEO_DEMOS)[DemoSlug]][]).map(
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

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries.join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
