import { SpotifyAuth } from "../auth/spotify-auth.ts";

export interface TrackInfo {
  trackName: string;
  artistName: string;
  albumName?: string; // アルバム名
  albumType?: string; // アルバムタイプ (album, single, compilation)
  isPlaying: boolean;
  source: string; // 音源情報
  popularity?: number; // 楽曲の人気度 (0-100)
  albumPopularity?: number; // アルバムの人気度 (0-100)
  artistPopularity?: number; // アーティストの人気度 (0-100)
}

export class SpotifyPlayer {
  private auth: SpotifyAuth;
  private config: any;
  private lastTrackInfo: TrackInfo | null = null;
  private apiCallCount = 0;
  private apiCallResetTime: number;

  constructor(auth: SpotifyAuth, config: any) {
    this.auth = auth;
    this.config = config;
    this.apiCallResetTime = Date.now() + config.spotifyRateLimitWindow;
  }

  async getCurrentlyPlaying(): Promise<TrackInfo | null> {
    if (!this.auth.isAuthenticated) {
      this.auth.showLoginWarning();
      return null;
    }

    // Rate limiting check - configurable API limit
    const now = Date.now();
    if (now > this.apiCallResetTime) {
      this.apiCallCount = 0;
      this.apiCallResetTime = now + this.config.spotifyRateLimitWindow;
    }

    if (this.apiCallCount >= this.config.spotifyApiLimit) {
      return this.lastTrackInfo; // Return cached info
    }

    this.auth.checkTokenExpiration();

    this.apiCallCount++;
    const res = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: {
          Authorization: `Bearer ${this.auth.token}`,
        },
      }
    );

    if (res.status === 204) {
      // No content, nothing is playing
      this.lastTrackInfo = null;
      return null;
    }
    if (res.status === 401) {
      // Unauthorized, token might have expired
      await this.auth.refreshAccessToken();
      return this.getCurrentlyPlaying(); // Retry after refreshing
    }
    if (res.status === 429) {
      // Rate limited by Spotify
      return this.lastTrackInfo; // Return cached info
    }
    if (!res.ok) {
      return this.lastTrackInfo; // Return cached info on error
    }

    const data = await res.json();
    if (!data.item) {
      this.lastTrackInfo = null;
      return null;
    }

    // Get album and artist popularity
    const albumId = data.item.album?.id;
    const artistId = data.item.artists?.[0]?.id; // Get first artist

    let albumPopularity: number | undefined;
    let artistPopularity: number | undefined;

    if (albumId) {
      albumPopularity = (await this.getAlbumPopularity(albumId)) || undefined;
    }

    if (artistId) {
      artistPopularity =
        (await this.getArtistPopularity(artistId)) || undefined;
    }

    const trackInfo: TrackInfo = {
      trackName: data.item.name,
      artistName: data.item.artists
        .map((artist: any) => artist.name)
        .join(", "),
      albumName: data.item.album?.name || undefined, // アルバム名
      albumType: data.item.album?.album_type || undefined, // アルバムタイプ
      isPlaying: data.is_playing,
      source: "Spotify",
      popularity:
        typeof data.item.popularity === "number"
          ? data.item.popularity
          : undefined,
      albumPopularity: albumPopularity || undefined,
      artistPopularity: artistPopularity || undefined,
    };

    this.lastTrackInfo = trackInfo;
    return trackInfo;
  }

  async getAlbumPopularity(albumId: string): Promise<number | null> {
    if (!this.auth.isAuthenticated) {
      return null;
    }

    this.auth.checkTokenExpiration();

    try {
      const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
        headers: {
          Authorization: `Bearer ${this.auth.token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        return data.popularity || null;
      }
    } catch (error) {
      // Silently handle errors
    }

    return null;
  }

  async getArtistPopularity(artistId: string): Promise<number | null> {
    if (!this.auth.isAuthenticated) {
      return null;
    }

    this.auth.checkTokenExpiration();

    try {
      const res = await fetch(
        `https://api.spotify.com/v1/artists/${artistId}`,
        {
          headers: {
            Authorization: `Bearer ${this.auth.token}`,
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        return data.popularity || null;
      }
    } catch (error) {
      // Silently handle errors
    }

    return null;
  }
}
