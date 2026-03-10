import {
  fetchYouTubeVideos,
  formatDuration,
  getVideoSlug,
} from "@/lib/youtube";
import { format, parseISO } from "date-fns";
import Image from "next/image";
import Link from "next/link";

export default async function VideosPage() {
  const videos = await fetchYouTubeVideos();

  return (
    <div>
      <div className="mb-10 sm:mb-14">
        <p className="text-sm font-medium tracking-wider uppercase text-[#FF6E00] mb-3">
          Resources
        </p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1A1A1A] tracking-tight">
          Videos
        </h1>
        <p className="mt-4 text-lg text-[#6B6B6B] max-w-2xl">
          Demos, tutorials, and deep dives on building AI copilots with Pillar.
        </p>
      </div>

      {videos.length === 0 ? (
        <p className="text-[#6B6B6B]">No videos available yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
          {videos.map((video) => (
            <Link
              key={video.videoId}
              href={`/resources/videos/${getVideoSlug(video)}`}
              className="group block"
            >
              <div className="relative aspect-video rounded-lg overflow-hidden bg-[#F3EFE8] border border-[#E5E0D8] group-hover:border-[#FF6E00]/40 transition-colors">
                <Image
                  src={video.thumbnailUrl}
                  alt={video.title}
                  fill
                  className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  sizes="(max-width: 640px) 100vw, 50vw"
                  unoptimized
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />

                {/* Duration badge */}
                {video.durationSec > 0 && (
                  <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-medium px-1.5 py-0.5 rounded">
                    {formatDuration(video.durationSec)}
                  </span>
                )}

                {/* Play icon overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-14 h-14 rounded-full bg-[#FF6E00]/90 flex items-center justify-center shadow-lg">
                    <svg
                      viewBox="0 0 24 24"
                      fill="white"
                      className="w-6 h-6 ml-0.5"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              <h2 className="mt-4 text-lg font-semibold text-[#1A1A1A] group-hover:text-[#FF6E00] transition-colors line-clamp-2">
                {video.title}
              </h2>
              <p className="mt-1.5 text-sm text-[#6B6B6B] line-clamp-2">
                {video.description}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-[#999]">
                <time dateTime={video.publishedAt}>
                  {format(parseISO(video.publishedAt), "MMM d, yyyy")}
                </time>
                {video.viewCount > 0 && (
                  <>
                    <span className="w-0.5 h-0.5 rounded-full bg-[#ccc]" />
                    <span>
                      {video.viewCount.toLocaleString()} view
                      {video.viewCount !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
