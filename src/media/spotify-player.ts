import { SpotifyAuth } from "../auth/spotify-auth.ts";

/**
 * トラック情報インターフェース
 */
export interface TrackInfo {
  trackName: string; // トラック名
  artistName: string; // アーティスト名
  albumName?: string; // アルバム名
  albumType?: string; // アルバムタイプ (album, single, compilation)
  isPlaying: boolean; // 再生中かどうか
  source: string; // 音源情報
  popularity?: number; // 楽曲の人気度 (0-100)
  albumPopularity?: number; // アルバムの人気度 (0-100)
  artistPopularity?: number; // アーティストの人気度 (0-100)
  durationMs?: number; // 曲の総時間 (ミリ秒)
  progressMs?: number; // 現在の再生位置 (ミリ秒)
}

/**
 * Spotifyプレイヤークラス
 * Spotify Web APIを使用して現在再生中のトラック情報を取得
 */
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

  /**
   * 現在再生中のトラック情報を取得
   * @returns トラック情報またはnull
   */
  async getCurrentlyPlaying(): Promise<TrackInfo | null> {
    if (!this.auth.isAuthenticated) {
      this.auth.showLoginWarning();
      return null;
    }

    // レートリミットチェック - 設定可能なAPI制限
    const now = Date.now();
    if (now > this.apiCallResetTime) {
      this.apiCallCount = 0;
      this.apiCallResetTime = now + this.config.spotifyRateLimitWindow;
    }

    if (this.apiCallCount >= this.config.spotifyApiLimit) {
      return this.lastTrackInfo; // キャッシュされた情報を返す
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
      // コンテンツなし、何も再生されていない
      this.lastTrackInfo = null;
      return null;
    }
    if (res.status === 401) {
      // 認証エラー、トークンが期限切れの可能性
      await this.auth.refreshAccessToken();
      return this.getCurrentlyPlaying(); // リフレッシュ後に再試行
    }
    if (res.status === 429) {
      // Spotifyによるレート制限
      return this.lastTrackInfo; // キャッシュされた情報を返す
    }
    if (!res.ok) {
      return this.lastTrackInfo; // エラー時はキャッシュされた情報を返す
    }

    const data = await res.json();
    if (!data.item) {
      this.lastTrackInfo = null;
      return null;
    }

    // アルバムとアーティストの人気度を取得
    const albumId = data.item.album?.id;
    const artistId = data.item.artists?.[0]?.id; // 最初のアーティストを取得

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
      durationMs: data.item.duration_ms || undefined, // 曲の総時間
      progressMs: data.progress_ms || undefined, // 現在の再生位置
    };

    this.lastTrackInfo = trackInfo;
    return trackInfo;
  }

  /**
   * アルバムの人気度を取得
   * @param albumId アルバムID
   * @returns 人気度（0-100）またはnull
   */
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
      // エラーを静かに処理
    }

    return null;
  }

  /**
   * アーティストの人気度を取得
   * @param artistId アーティストID
   * @returns 人気度（0-100）またはnull
   */
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
      // エラーを静かに処理
    }

    return null;
  }
}
