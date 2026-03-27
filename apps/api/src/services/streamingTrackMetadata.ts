/**
 * Métadonnées titre / pochette à partir d’un lien public (pas de téléchargement du master).
 * L’audio de la pub reste l’upload utilisateur (WAV / MP3).
 */
import { getAppAccessToken, fetchSpotifyTrackById, parseSpotifyTrackIdFromInput } from './spotify';

export type StreamingMetadataSource = 'SPOTIFY' | 'YOUTUBE' | 'SOUNDCLOUD' | 'APPLE_MUSIC';

export interface StreamingTrackMetadata {
  source: StreamingMetadataSource;
  /** Renseigné seulement si la source est Spotify (référence campagne). */
  spotifyTrackId: string | null;
  externalId: string | null;
  name: string;
  artistName: string;
  albumName: string;
  albumImageUrl: string | null;
  durationMs: number;
}

function parseYoutubeVideoId(input: string): string | null {
  const raw = input.trim();
  try {
    const u = new URL(raw);
    const h = u.hostname.replace(/^www\./i, '').toLowerCase();
    if (h === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id && /^[a-zA-Z0-9_-]{6,}$/.test(id) ? id : null;
    }
    if (h === 'm.youtube.com' || h === 'youtube.com' || h === 'www.youtube.com' || h === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{6,}$/.test(v)) return v;
      let m = /\/embed\/([a-zA-Z0-9_-]+)/.exec(u.pathname);
      if (m) return m[1];
      m = /\/shorts\/([a-zA-Z0-9_-]+)/.exec(u.pathname);
      if (m) return m[1];
    }
    if (h === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{6,}$/.test(v)) return v;
      const m = /\/watch\?v=([a-zA-Z0-9_-]+)/.exec(u.href);
      if (m) return m[1];
    }
  } catch {
    /* */
  }
  return null;
}

function parseAppleMusicTrackId(urlStr: string): string | null {
  try {
    const u = new URL(urlStr.trim());
    const h = u.hostname.replace(/^www\./i, '').toLowerCase();
    if (!h.includes('music.apple.com')) return null;
    const i = u.searchParams.get('i');
    if (i && /^\d+$/.test(i)) return i;
    const m = /\/song\/[^/]+\/(\d{6,})/.exec(u.pathname);
    if (m) return m[1];
  } catch {
    /* */
  }
  return null;
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

async function fetchYoutubeOembed(pageUrl: string): Promise<{
  title: string;
  artistName: string;
  albumName: string;
  thumbnailUrl: string | null;
} | null> {
  const oembedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(pageUrl)}`;
  const json = (await fetchJson(oembedUrl)) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  } | null;
  if (!json?.title) return null;
  const author = (json.author_name ?? '').replace(/\s*-\s*Topic$/i, '').trim();
  const title = json.title.trim();
  let artistName = author || '—';
  let trackTitle = title;
  const parts = title.split(/\s+-\s+/).map((s) => s.trim());
  if (parts.length >= 2 && (!author || author === '—')) {
    artistName = parts[0];
    trackTitle = parts.slice(1).join(' - ');
  }
  return {
    title: trackTitle,
    artistName: artistName || '—',
    albumName: 'YouTube',
    thumbnailUrl: json.thumbnail_url ?? null,
  };
}

async function fetchSoundcloudOembed(pageUrl: string): Promise<{
  title: string;
  artistName: string;
  albumName: string;
  thumbnailUrl: string | null;
} | null> {
  const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(pageUrl)}`;
  const json = (await fetchJson(oembedUrl)) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  } | null;
  if (!json?.title) return null;
  return {
    title: json.title.trim(),
    artistName: (json.author_name ?? '—').trim(),
    albumName: 'SoundCloud',
    thumbnailUrl: json.thumbnail_url ?? null,
  };
}

async function fetchItunesTrack(trackId: string): Promise<{
  name: string;
  artistName: string;
  albumName: string;
  albumImageUrl: string | null;
  durationMs: number;
} | null> {
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(trackId)}`;
  const json = (await fetchJson(url)) as {
    resultCount?: number;
    results?: Array<{
      kind?: string;
      wrapperType?: string;
      trackName?: string;
      artistName?: string;
      collectionName?: string;
      artworkUrl100?: string;
      trackTimeMillis?: number;
    }>;
  } | null;
  if (!json?.results?.length) return null;
  const r =
    json.results.find((x) => x.kind === 'song' || x.wrapperType === 'track') ?? json.results[0];
  if (!r?.trackName) return null;
  const art = r.artworkUrl100?.replace(/100x100bb/g, '600x600bb') ?? null;
  return {
    name: r.trackName,
    artistName: (r.artistName ?? '').trim() || '—',
    albumName: (r.collectionName ?? '').trim() || 'Apple Music',
    albumImageUrl: art,
    durationMs: r.trackTimeMillis ?? 0,
  };
}

export async function resolveStreamingTrackMetadata(rawUrl: string): Promise<StreamingTrackMetadata | null> {
  const url = rawUrl.trim();
  if (!url) return null;

  const spotifyId = parseSpotifyTrackIdFromInput(url);
  if (spotifyId) {
    try {
      const token = await getAppAccessToken();
      const t = await fetchSpotifyTrackById(token, spotifyId);
      if (!t) return null;
      return {
        source: 'SPOTIFY',
        spotifyTrackId: t.id,
        externalId: t.id,
        name: t.name,
        artistName: t.artistName,
        albumName: t.albumName,
        albumImageUrl: t.albumImageUrl,
        durationMs: t.durationMs,
      };
    } catch {
      return null;
    }
  }

  const appleId = parseAppleMusicTrackId(url);
  if (appleId) {
    const m = await fetchItunesTrack(appleId);
    if (m) {
      return {
        source: 'APPLE_MUSIC',
        spotifyTrackId: null,
        externalId: appleId,
        name: m.name,
        artistName: m.artistName,
        albumName: m.albumName,
        albumImageUrl: m.albumImageUrl,
        durationMs: m.durationMs,
      };
    }
  }

  const ytId = parseYoutubeVideoId(url);
  if (ytId) {
    const m = await fetchYoutubeOembed(url);
    if (m) {
      return {
        source: 'YOUTUBE',
        spotifyTrackId: null,
        externalId: ytId,
        name: m.title,
        artistName: m.artistName,
        albumName: m.albumName,
        albumImageUrl: m.thumbnailUrl,
        durationMs: 0,
      };
    }
  }

  if (/soundcloud\.com/i.test(url)) {
    const m = await fetchSoundcloudOembed(url);
    if (m) {
      return {
        source: 'SOUNDCLOUD',
        spotifyTrackId: null,
        externalId: null,
        name: m.title,
        artistName: m.artistName,
        albumName: m.albumName,
        albumImageUrl: m.thumbnailUrl,
        durationMs: 0,
      };
    }
  }

  return null;
}
