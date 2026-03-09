const CHANNEL_ID = "UCQSvzxY6-4ilUrpIDb7-kGQ";
const UPLOADS_PLAYLIST_ID = "UUQSvzxY6-4ilUrpIDb7-kGQ";
const API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  thumbnailHigh: string;
  channelName: string;
  durationISO: string;
  durationSec: number;
  viewCount: number;
  likeCount: number;
  tags: string[];
}

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY env var is not set");
  return key;
}

/**
 * Convert ISO 8601 duration (PT1H2M3S) to seconds.
 */
function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || "0", 10);
  const m = parseInt(match[2] || "0", 10);
  const s = parseInt(match[3] || "0", 10);
  return h * 3600 + m * 60 + s;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface PlaylistItemsResponse {
  items?: {
    snippet: {
      resourceId: { videoId: string };
    };
  }[];
  nextPageToken?: string;
}

interface VideosResponse {
  items?: {
    id: string;
    snippet: {
      title: string;
      description: string;
      publishedAt: string;
      channelTitle: string;
      tags?: string[];
      thumbnails: {
        high?: { url: string };
        maxres?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
    };
    contentDetails: {
      duration: string;
    };
    statistics: {
      viewCount?: string;
      likeCount?: string;
    };
  }[];
}

async function fetchAllVideoIds(apiKey: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId: UPLOADS_PLAYLIST_ID,
      maxResults: "50",
      key: apiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${API_BASE}/playlistItems?${params}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error(`YouTube playlistItems failed: ${res.status}`);
      break;
    }

    const data: PlaylistItemsResponse = await res.json();
    for (const item of data.items ?? []) {
      ids.push(item.snippet.resourceId.videoId);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return ids;
}

async function fetchVideoDetails(
  videoIds: string[],
  apiKey: string,
): Promise<YouTubeVideo[]> {
  if (videoIds.length === 0) return [];

  const videos: YouTubeVideo[] = [];

  // API allows up to 50 IDs per request
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      part: "snippet,contentDetails,statistics",
      id: batch.join(","),
      key: apiKey,
    });

    const res = await fetch(`${API_BASE}/videos?${params}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error(`YouTube videos.list failed: ${res.status}`);
      continue;
    }

    const data: VideosResponse = await res.json();
    for (const item of data.items ?? []) {
      const thumbs = item.snippet.thumbnails;
      videos.push({
        videoId: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl:
          thumbs.high?.url ??
          thumbs.medium?.url ??
          thumbs.default?.url ??
          `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        thumbnailHigh:
          thumbs.maxres?.url ??
          thumbs.high?.url ??
          `https://i.ytimg.com/vi/${item.id}/maxresdefault.jpg`,
        channelName: item.snippet.channelTitle || "Pillar",
        durationISO: item.contentDetails.duration,
        durationSec: parseDuration(item.contentDetails.duration),
        viewCount: parseInt(item.statistics.viewCount ?? "0", 10),
        likeCount: parseInt(item.statistics.likeCount ?? "0", 10),
        tags: item.snippet.tags ?? [],
      });
    }
  }

  return videos;
}

export async function fetchYouTubeVideos(): Promise<YouTubeVideo[]> {
  const apiKey = getApiKey();
  const videoIds = await fetchAllVideoIds(apiKey);
  return fetchVideoDetails(videoIds, apiKey);
}

export async function fetchYouTubeVideo(
  videoId: string,
): Promise<YouTubeVideo | null> {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    part: "snippet,contentDetails,statistics",
    id: videoId,
    key: apiKey,
  });

  const res = await fetch(`${API_BASE}/videos?${params}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;

  const data: VideosResponse = await res.json();
  const item = data.items?.[0];
  if (!item) return null;

  const thumbs = item.snippet.thumbnails;
  return {
    videoId: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl:
      thumbs.high?.url ??
      thumbs.medium?.url ??
      `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    thumbnailHigh:
      thumbs.maxres?.url ??
      thumbs.high?.url ??
      `https://i.ytimg.com/vi/${item.id}/maxresdefault.jpg`,
    channelName: item.snippet.channelTitle || "Pillar",
    durationISO: item.contentDetails.duration,
    durationSec: parseDuration(item.contentDetails.duration),
    viewCount: parseInt(item.statistics.viewCount ?? "0", 10),
    likeCount: parseInt(item.statistics.likeCount ?? "0", 10),
    tags: item.snippet.tags ?? [],
  };
}

export function getVideoSlug(video: YouTubeVideo): string {
  return `${slugify(video.title)}-${video.videoId}`;
}

export function parseVideoSlug(slug: string): string | null {
  // YouTube video IDs are always 11 characters, so extract from the end
  // This handles video IDs that contain dashes (e.g., "Xy3-AbC7890")
  if (slug.length < 11) return null;
  return slug.slice(-11);
}

export function getMaxResThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
