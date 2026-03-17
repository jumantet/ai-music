export interface PexelsVideo {
  id: string;
  url: string;
  thumbnailUrl: string;
  previewUrl: string;
  duration: number;
  width: number;
  height: number;
  photographer: string;
  photographerUrl: string;
}

interface PexelsVideoFile {
  link: string;
  quality: string;
  file_type: string;
  width: number | null;
  height: number | null;
}

interface PexelsVideoItem {
  id: number;
  url: string;
  duration: number;
  width: number;
  height: number;
  image: string;
  user: {
    name: string;
    url: string;
  };
  video_files: PexelsVideoFile[];
}

interface PexelsVideosResponse {
  videos: PexelsVideoItem[];
  total_results: number;
}

function getBestVideoFile(files: PexelsVideoFile[]): PexelsVideoFile | undefined {
  const hdFiles = files.filter(
    (f) => f.file_type === 'video/mp4' && f.quality === 'hd' && f.width !== null
  );
  if (hdFiles.length > 0) {
    return hdFiles.sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0];
  }
  return files.find((f) => f.file_type === 'video/mp4');
}

export interface PexelsVideosPage {
  videos: PexelsVideo[];
  totalResults: number;
  page: number;
  perPage: number;
}

export async function searchVideos(
  keywords: string[],
  orientation: 'portrait' | 'landscape' | 'square' = 'portrait',
  perPage = 8,
  page = 1
): Promise<PexelsVideosPage> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.warn('[Pexels] PEXELS_API_KEY is not set — returning empty results');
    return { videos: [], totalResults: 0, page, perPage };
  }

  const query = keywords.slice(0, 3).join(' ');
  const url = new URL('https://api.pexels.com/videos/search');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', orientation);
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('page', String(page));
  url.searchParams.set('size', 'medium');

  const response = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });

  if (!response.ok) {
    throw new Error(`Pexels API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as PexelsVideosResponse;

  return {
    videos: data.videos.map((video) => {
      const bestFile = getBestVideoFile(video.video_files);
      return {
        id: String(video.id),
        url: video.url,
        thumbnailUrl: video.image,
        previewUrl: bestFile?.link ?? video.url,
        duration: video.duration,
        width: video.width,
        height: video.height,
        photographer: video.user.name,
        photographerUrl: video.user.url,
      };
    }),
    totalResults: data.total_results,
    page,
    perPage,
  };
}
