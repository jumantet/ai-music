/**
 * Spotify Web API via Client Credentials — catalogue public (titres, métadonnées).
 * Pas de connexion compte Spotify utilisateur : l’audio de la pub reste l’upload S3.
 */
const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com';
const SPOTIFY_API = 'https://api.spotify.com/v1';

let appTokenCache: { token: string; expiresAtMs: number } | null = null;

function getClientCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SPOTIFY_CLIENT_ID ?? '';
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET ?? '';
  if (!clientId || !clientSecret) {
    throw new Error('Spotify is not configured (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET).');
  }
  return { clientId, clientSecret };
}

function basicAuthHeader(): string {
  const { clientId, clientSecret } = getClientCreds();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

/** Jeton application (client credentials), mis en cache jusqu’à expiration. */
export async function getAppAccessToken(): Promise<string> {
  const now = Date.now();
  if (appTokenCache && now < appTokenCache.expiresAtMs - 60_000) {
    return appTokenCache.token;
  }
  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(),
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify client credentials failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  const expiresInSec = data.expires_in ?? 3600;
  appTokenCache = {
    token: data.access_token,
    expiresAtMs: now + expiresInSec * 1000,
  };
  return data.access_token;
}

/** Marché pour le catalogue (albums / titres). Requis ou fortement recommandé par Spotify ; sinon listes souvent vides en client credentials. */
function spotifyMarket(): string {
  return process.env.SPOTIFY_MARKET?.trim() || 'US';
}

export interface SpotifyArtistBrief {
  id: string;
  name: string;
  imageUrl: string | null;
}

export async function searchSpotifyArtists(
  accessToken: string,
  query: string,
  limit = 10
): Promise<SpotifyArtistBrief[]> {
  // Spotify GET /search : limit par type entre 1 et 10 (doc officielle, sinon 400 Invalid limit).
  const n = typeof limit === 'number' && Number.isFinite(limit) ? Math.trunc(limit) : 10;
  const safeLimit = Math.min(Math.max(n, 1), 10);

  const params = new URLSearchParams({
    q: query,
    type: 'artist',
    limit: String(safeLimit),
  });
  params.set('market', spotifyMarket());
  const res = await fetch(`${SPOTIFY_API}/search?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify search failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    artists?: { items?: Array<{ id: string; name: string; images?: { url: string }[] }> };
  };
  const items = data.artists?.items ?? [];
  return items.map((a) => ({
    id: a.id,
    name: a.name,
    imageUrl: a.images?.[0]?.url ?? null,
  }));
}

export interface SpotifyTrackBrief {
  id: string;
  name: string;
  artistName: string;
  albumName: string;
  albumImageUrl: string | null;
  previewUrl: string | null;
  durationMs: number;
}

function pickAlbumCoverUrl(images?: { url: string }[] | null): string | null {
  if (!images?.length) return null;
  return images[1]?.url ?? images[0]?.url ?? null;
}

/** Albums de l’artiste (id + nom). On n’utilise pas GET /albums?ids= : souvent 403 en client credentials. */
async function fetchAllAlbumsForArtist(
  accessToken: string,
  artistId: string
): Promise<Array<{ id: string; name: string; imageUrl: string | null }>> {
  const albums: Array<{ id: string; name: string; imageUrl: string | null }> = [];
  const m = encodeURIComponent(spotifyMarket());
  // Spotify renvoie 400 « Invalid limit » au-delà de 10 pour cet endpoint (client credentials).
  let url: string | null =
    `${SPOTIFY_API}/artists/${encodeURIComponent(artistId)}/albums?include_groups=album,single&limit=10&market=${m}`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Spotify artist albums failed: ${res.status} ${text}`);
    }
    const page = (await res.json()) as {
      items: { id: string; name: string; images?: { url: string }[] }[];
      next: string | null;
    };
    for (const it of page.items) {
      if (it?.id) {
        albums.push({
          id: it.id,
          name: it.name ?? '',
          imageUrl: pickAlbumCoverUrl(it.images),
        });
      }
    }
    url = page.next;
  }
  return albums;
}

async function fetchAlbumTracksPaginated(
  accessToken: string,
  albumId: string
): Promise<
  Array<{
    id: string;
    name: string;
    duration_ms: number;
    preview_url: string | null;
    artists: { name: string }[];
  }>
> {
  const all: Array<{
    id: string;
    name: string;
    duration_ms: number;
    preview_url: string | null;
    artists: { name: string }[];
  }> = [];
  const m = encodeURIComponent(spotifyMarket());
  let url: string | null = `${SPOTIFY_API}/albums/${encodeURIComponent(albumId)}/tracks?limit=50&market=${m}`;
  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Spotify album tracks failed: ${res.status} ${text}`);
    }
    const page = (await res.json()) as {
      items: Array<{
        id: string;
        name: string;
        duration_ms: number;
        preview_url: string | null;
        artists: { name: string }[];
      }>;
      next: string | null;
    };
    all.push(...page.items);
    url = page.next;
  }
  return all;
}

/** Titres populaires (market obligatoire sur cet endpoint). Sert de repli si la liste d’albums est vide. */
async function fetchArtistTopTracksBrief(
  accessToken: string,
  artistId: string,
  maxTracks: number
): Promise<SpotifyTrackBrief[]> {
  const m = encodeURIComponent(spotifyMarket());
  const res = await fetch(
    `${SPOTIFY_API}/artists/${encodeURIComponent(artistId)}/top-tracks?market=${m}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    // Top-tracks peut refuser le client credentials (403) selon l’app / la doc ; le catalogue albums suffit en général.
    return [];
  }
  const data = (await res.json()) as {
    tracks?: Array<{
      id: string;
      name: string;
      duration_ms: number;
      preview_url: string | null;
      artists: { name: string }[];
      album?: { name: string; images?: { url: string }[] };
    }>;
  };
  const tracks = data.tracks ?? [];
  const out: SpotifyTrackBrief[] = [];
  for (const t of tracks) {
    if (!t?.id) continue;
    out.push({
      id: t.id,
      name: t.name,
      artistName: t.artists.map((x) => x.name).join(', '),
      albumName: t.album?.name ?? '',
      albumImageUrl: pickAlbumCoverUrl(t.album?.images),
      previewUrl: t.preview_url,
      durationMs: t.duration_ms,
    });
    if (out.length >= maxTracks) break;
  }
  return out;
}

export async function fetchTracksForArtist(
  accessToken: string,
  artistId: string,
  maxTracks = 120
): Promise<SpotifyTrackBrief[]> {
  const artistAlbums = await fetchAllAlbumsForArtist(accessToken, artistId);

  const byTrackId = new Map<string, SpotifyTrackBrief>();
  for (const { id: albumId, name: albumName, imageUrl: albumImageUrl } of artistAlbums) {
    if (byTrackId.size >= maxTracks) break;
    const tracks = await fetchAlbumTracksPaginated(accessToken, albumId);
    for (const t of tracks) {
      if (!t?.id) continue;
      if (byTrackId.has(t.id)) continue;
      byTrackId.set(t.id, {
        id: t.id,
        name: t.name,
        artistName: t.artists.map((x) => x.name).join(', '),
        albumName,
        albumImageUrl,
        previewUrl: t.preview_url,
        durationMs: t.duration_ms,
      });
      if (byTrackId.size >= maxTracks) break;
    }
  }

  const fromAlbums = [...byTrackId.values()];
  if (fromAlbums.length > 0) {
    return fromAlbums;
  }

  return fetchArtistTopTracksBrief(accessToken, artistId, maxTracks);
}
