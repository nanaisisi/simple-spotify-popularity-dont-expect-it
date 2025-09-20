import { SpotifyAuth } from "../auth/spotify-auth.ts";

export interface TrackInfo {
  trackName: string;
  artistName: string;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  duration: number; // 秒数表示用
  isInPlaylist: boolean; // プレイリスト情報用
  source: string; // 音源情報
  contextType?: string; // 再生コンテキストタイプ (playlist, album, artist, etc.)
  contextUri?: string; // 再生コンテキストURI
  popularity?: number; // 人気度 (0-100)
  isLocal?: boolean; // ローカルファイルかどうか
  playlistStatus?: "current" | "other" | "none"; // より正確なプレイリスト状態
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

  /**
   * 楽曲が指定されたプレイリストに実際に含まれているかチェック
   */
  private async isTrackInPlaylist(
    trackId: string,
    playlistId: string
  ): Promise<boolean> {
    if (!this.auth.isAuthenticated) {
      return false;
    }

    try {
      // プレイリストIDからspotify:playlist:の部分を取り除く
      const cleanPlaylistId = playlistId.replace("spotify:playlist:", "");

      // プレイリストの楽曲を取得（最大50件ずつ）
      let offset = 0;
      const limit = 50;
      let hasMore = true;

      while (hasMore) {
        const res = await fetch(
          `https://api.spotify.com/v1/playlists/${cleanPlaylistId}/tracks?limit=${limit}&offset=${offset}&fields=items(track(id)),total`,
          {
            headers: {
              Authorization: `Bearer ${this.auth.token}`,
            },
          }
        );

        if (!res.ok) {
          console.error(`Error checking playlist tracks: ${res.status}`);
          return false;
        }

        const data = await res.json();

        // 現在のバッチで楽曲をチェック
        for (const item of data.items) {
          if (item.track?.id === trackId) {
            return true;
          }
        }

        // 次のページがあるかチェック
        offset += limit;
        hasMore = offset < data.total;
      }

      return false;
    } catch (error) {
      console.error("Error checking track in playlist:", error);
      return false;
    }
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

    // プレイリスト状態の正確な判定
    let playlistStatus: "current" | "other" | "none" = "none";
    const isInPlaylist = data.context && data.context.type === "playlist";

    if (data.context) {
      if (data.context.type === "playlist") {
        // プレイリストから再生中 - 実際に楽曲がプレイリストに含まれているかチェック
        const actuallyInPlaylist = await this.isTrackInPlaylist(
          data.item.id,
          data.context.uri
        );
        playlistStatus = actuallyInPlaylist ? "current" : "none";
      } else if (["album", "artist", "show"].includes(data.context.type)) {
        // アルバム、アーティスト、ポッドキャストから再生
        // この楽曲が他のプレイリストにある可能性が高い
        playlistStatus = "other";
      } else {
        // ミックス、レコメンド、ラジオなど
        playlistStatus = "none";
      }
    }

    const trackInfo: TrackInfo = {
      trackName: data.item.name,
      artistName: data.item.artists
        .map((artist: any) => artist.name)
        .join(", "),
      isPlaying: data.is_playing,
      progressMs: data.progress_ms,
      durationMs: data.item.duration_ms,
      duration: Math.floor(data.item.duration_ms / 1000), // ミリ秒から秒に変換
      isInPlaylist: playlistStatus === "current", // 実際にプレイリストに含まれている場合のみtrue
      source: "Spotify",
      contextType: data.context?.type || null,
      contextUri: data.context?.uri || null,
      popularity:
        typeof data.item.popularity === "number"
          ? data.item.popularity
          : undefined,
      isLocal:
        typeof data.item.is_local === "boolean"
          ? data.item.is_local
          : undefined,
      playlistStatus: playlistStatus,
    };

    this.lastTrackInfo = trackInfo;
    return trackInfo;
  }
}
