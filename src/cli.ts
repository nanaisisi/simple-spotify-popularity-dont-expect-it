/**
 * CLI for displaying Spotify track popularity
 * Polls currently playing track and displays track name and popularity
 */

import { loadConfig, validateConfig } from "../config.ts";
import { SpotifyAuth } from "./auth/spotify-auth.ts";
import { SpotifyPlayer } from "./media/spotify-player.ts";

async function main() {
  try {
    // Load and validate configuration
    const config = loadConfig();
    validateConfig(config);

    // Initialize components
    const spotifyAuth = new SpotifyAuth(config);
    const spotifyPlayer = new SpotifyPlayer(spotifyAuth, config);

    // トークンファイルの変更を監視
    const watcher = Deno.watchFs("spotify_tokens.json");

    // 認証状態を確認する関数
    const checkAuth = () => {
      spotifyAuth.reloadTokens(); // 最新のトークンを読み込み
      return spotifyAuth.isAuthenticated;
    };

    // 認証を待つ
    let authenticated = checkAuth();
    if (!authenticated) {
      // ファイル変更を監視して認証を待つ
      for await (const event of watcher) {
        if (event.kind === "modify" || event.kind === "create") {
          authenticated = checkAuth();
          if (authenticated) {
            break;
          }
        }
      }
    }

    let lastTrackName = "";

    // Main polling loop
    while (true) {
      try {
        const trackInfo = await spotifyPlayer.getCurrentlyPlaying();

        if (trackInfo && trackInfo.trackName !== lastTrackName) {
          lastTrackName = trackInfo.trackName;
          const popularity = trackInfo.popularity ?? "Unknown";
          const albumPopularity = trackInfo.albumPopularity ?? "Unknown";
          const artistPopularity = trackInfo.artistPopularity ?? "Unknown";

          console.log(
            `${trackInfo.trackName} - Track: ${popularity}/100, Album: ${albumPopularity}/100, Artist: ${artistPopularity}/100`
          );
        }

        await new Promise((resolve) =>
          setTimeout(resolve, config.pollingInterval)
        );
      } catch (error) {
        // エラーメッセージも表示しない
        await new Promise((resolve) =>
          setTimeout(resolve, config.pollingInterval)
        );
      }
    }
  } catch (error) {
    // 起動失敗時もメッセージを表示しない
    (globalThis as any).Deno.exit(1);
  }
}
main();
