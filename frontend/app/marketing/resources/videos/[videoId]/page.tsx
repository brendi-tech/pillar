import {
  fetchYouTubeVideo,
  fetchYouTubeVideos,
  formatDuration,
  getMaxResThumbnail,
  getVideoSlug,
  parseVideoSlug,
} from "@/lib/youtube";
import { format, parseISO } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ videoId: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { videoId: slug } = await params;
  const videoId = parseVideoSlug(slug);
  if (!videoId) return {};

  const video = await fetchYouTubeVideo(videoId);
  if (!video) return {};

  const description = video.description.slice(0, 160);

  return {
    title: `${video.title} | Pillar`,
    description,
    openGraph: {
      title: video.title,
      description,
      type: "video.other",
      url: `https://trypillar.com/resources/videos/${getVideoSlug(video)}`,
      images: [
        {
          url: video.thumbnailHigh,
          width: 1280,
          height: 720,
          alt: video.title,
        },
      ],
      videos: [
        {
          url: `https://www.youtube.com/embed/${video.videoId}`,
          width: 1280,
          height: 720,
          type: "text/html",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: video.title,
      description,
      images: [video.thumbnailHigh],
    },
    alternates: {
      canonical: `https://trypillar.com/resources/videos/${getVideoSlug(video)}`,
    },
  };
}

export async function generateStaticParams() {
  try {
    const videos = await fetchYouTubeVideos();
    return videos.map((video) => ({
      videoId: getVideoSlug(video),
    }));
  } catch {
    return [];
  }
}

export default async function VideoPage({ params }: PageProps) {
  const { videoId: slug } = await params;
  const videoId = parseVideoSlug(slug);
  if (!videoId) notFound();

  const [video, allVideos] = await Promise.all([
    fetchYouTubeVideo(videoId),
    fetchYouTubeVideos(),
  ]);

  if (!video) notFound();

  const relatedVideos = allVideos
    .filter((v) => v.videoId !== video.videoId)
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnailHigh,
    uploadDate: video.publishedAt,
    duration: video.durationISO,
    contentUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
    embedUrl: `https://www.youtube.com/embed/${video.videoId}`,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: { "@type": "WatchAction" },
      userInteractionCount: video.viewCount,
    },
    publisher: {
      "@type": "Organization",
      name: "Pillar",
      url: "https://trypillar.com",
      logo: {
        "@type": "ImageObject",
        url: "https://trypillar.com/pillar-logo.png",
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-[#6B6B6B]">
          <Link
            href="/resources/videos"
            className="hover:text-[#FF6E00] transition-colors"
          >
            Videos
          </Link>
          <span className="mx-2">›</span>
          <span className="text-[#1A1A1A]">{video.title}</span>
        </nav>

        {/* Video embed */}
        <div className="relative aspect-video rounded-lg overflow-hidden bg-black shadow-lg">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.videoId}?rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>

        {/* Title & meta */}
        <div className="mt-6 sm:mt-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] tracking-tight">
            {video.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#6B6B6B]">
            <span>{video.channelName}</span>
            <span className="w-1 h-1 rounded-full bg-[#ccc]" />
            <time dateTime={video.publishedAt}>
              {format(parseISO(video.publishedAt), "MMMM d, yyyy")}
            </time>
            {video.durationSec > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-[#ccc]" />
                <span>{formatDuration(video.durationSec)}</span>
              </>
            )}
            {video.viewCount > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-[#ccc]" />
                <span>
                  {video.viewCount.toLocaleString()} view
                  {video.viewCount !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {video.description && (
          <div className="mt-6 p-5 sm:p-6 rounded-lg bg-[#FAFAF8] border border-[#E5E0D8]">
            <p className="text-[#444] leading-relaxed whitespace-pre-line text-[15px]">
              {video.description}
            </p>
          </div>
        )}

        {/* Tags */}
        {video.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {video.tags.slice(0, 12).map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-full bg-[#F3EFE8] text-[#6B6B6B] border border-[#E5E0D8]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Related videos */}
        {relatedVideos.length > 0 && (
          <div className="mt-12 pt-10 border-t border-[#E5E0D8]">
            <h2 className="text-xl font-semibold text-[#1A1A1A] mb-6">
              More videos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {relatedVideos.map((rv) => (
                <Link
                  key={rv.videoId}
                  href={`/resources/videos/${getVideoSlug(rv)}`}
                  className="group block"
                >
                  <div className="relative aspect-video rounded-md overflow-hidden bg-[#F3EFE8] border border-[#E5E0D8] group-hover:border-[#FF6E00]/40 transition-colors">
                    <img
                      src={rv.thumbnailUrl}
                      alt={rv.title}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                    {rv.durationSec > 0 && (
                      <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                        {formatDuration(rv.durationSec)}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 text-sm font-medium text-[#1A1A1A] group-hover:text-[#FF6E00] transition-colors line-clamp-2">
                    {rv.title}
                  </h3>
                  <time
                    dateTime={rv.publishedAt}
                    className="mt-1 block text-xs text-[#999]"
                  >
                    {format(parseISO(rv.publishedAt), "MMM d, yyyy")}
                  </time>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
