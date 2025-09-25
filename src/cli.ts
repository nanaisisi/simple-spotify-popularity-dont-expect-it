/**
 * Spotifyトラック人気度表示CLI
 * 現在再生中のトラックをポーリングし、トラック名と人気度を表示
 */

import { loadConfig, validateConfig } from "../config.ts";
import { SpotifyAuth } from "./auth/spotify-auth.ts";
import { SpotifyPlayer } from "./media/spotify-player.ts";

async function main() {
  try {
    // 設定を読み込み・検証
    const config = loadConfig();
    validateConfig(config);

    // コンポーネントを初期化
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
    let currentTrackStartTime = 0; // 現在の曲の開始時刻
    let pollingInterval = config.spotifyShortInterval; // 初期は短間隔
    let isWaitingForTrackEnd = false; // 曲終了待機中フラグ

    // メインのポーリングループ
    while (true) {
      try {
        if (config.debugMode) {
          console.log(
            `[DEBUG] API取得開始: ${new Date().toLocaleTimeString()}`
          );
        }

        const trackInfo = await spotifyPlayer.getCurrentlyPlaying();

        if (config.debugMode) {
          const status = trackInfo ? "成功" : "再生中なし";
          console.log(
            `[DEBUG] API取得完了: ${status} (${new Date().toLocaleTimeString()})`
          );
        }

        if (trackInfo) {
          const now = Date.now();

          // 曲が変わった場合の処理
          if (trackInfo.trackName !== lastTrackName) {
            lastTrackName = trackInfo.trackName;
            currentTrackStartTime = now - (trackInfo.progressMs || 0); // 曲の開始時刻を計算

            if (config.debugMode) {
              const durationSec = trackInfo.durationMs
                ? Math.round(trackInfo.durationMs / 1000)
                : "Unknown";
              const progressSec = trackInfo.progressMs
                ? Math.round(trackInfo.progressMs / 1000)
                : 0;
              const waitReason = isWaitingForTrackEnd ? " (曲終了待機後)" : "";
              console.log(
                `[DEBUG] 新曲検知: ${
                  trackInfo.trackName
                } (総時間: ${durationSec}秒, 現在: ${progressSec}秒, 開始時刻: ${new Date(
                  currentTrackStartTime
                ).toLocaleTimeString()})${waitReason}`
              );
            }

            // 曲終了待機中だった場合、次の確認は通常間隔に戻す
            if (isWaitingForTrackEnd) {
              pollingInterval = config.spotifyShortInterval;
              isWaitingForTrackEnd = false;
              if (config.debugMode) {
                console.log(
                  `[DEBUG] 曲終了予測成功 → 通常間隔${
                    pollingInterval / 1000
                  }秒に戻す`
                );
              }
            } else {
              pollingInterval = config.spotifyShortInterval; // 新しい曲なので通常間隔
              if (config.debugMode) {
                console.log(
                  `[DEBUG] 通常曲切り替え → 通常間隔${pollingInterval / 1000}秒`
                );
              }
            }

            // 人気度を表示
            const popularity = trackInfo.popularity ?? "Unknown";
            const albumPopularity = trackInfo.albumPopularity ?? "Unknown";
            const artistPopularity = trackInfo.artistPopularity ?? "Unknown";

            console.log(
              `${trackInfo.trackName} - Track: ${popularity}/100, Album: ${albumPopularity}/100, Artist: ${artistPopularity}/100`
            );
          }

          // 動的ポーリング間隔の計算
          if (trackInfo.durationMs && trackInfo.progressMs !== undefined) {
            const remaining = trackInfo.durationMs - trackInfo.progressMs; // 残り時間
            const elapsed = now - currentTrackStartTime; // 経過時間

            // 経過時間が負の値になる場合（曲の開始時刻計算が狂っている）はリセット
            const safeElapsed = Math.max(0, elapsed);

            if (config.debugMode) {
              console.log(
                `[DEBUG] ポーリング分析: 曲名=${
                  trackInfo.trackName
                }, 総時間=${Math.round(
                  trackInfo.durationMs / 1000
                )}秒, 現在=${Math.round(
                  trackInfo.progressMs / 1000
                )}秒, 残り=${Math.round(remaining / 1000)}秒, 経過=${Math.round(
                  safeElapsed / 1000
                )}秒`
              );
            }

            if (remaining <= 30000) {
              // 曲終了が近い場合（30秒以内）
              // 次回の確認は曲終了後3秒以上待ってから
              pollingInterval = remaining + 3000; // 曲の残り時間 + 3秒
              isWaitingForTrackEnd = true; // 曲終了待機中フラグを設定
              if (config.debugMode) {
                const predictedEndTime = new Date(
                  now + pollingInterval
                ).toLocaleTimeString();
                console.log(
                  `[DEBUG] 曲終了予測: 残り${Math.round(
                    remaining / 1000
                  )}秒 → ${Math.round(
                    pollingInterval / 1000
                  )}秒後 (${predictedEndTime}) に確認予定`
                );
              }
            } else if (safeElapsed >= config.longPollingThreshold) {
              // 同じ曲が45秒以上再生されている場合
              pollingInterval = config.spotifyLongInterval; // 60秒
              if (config.debugMode) {
                console.log(
                  `[DEBUG] 長時間再生: 経過${Math.round(
                    safeElapsed / 1000
                  )}秒 → 次回確認まで${pollingInterval / 1000}秒`
                );
              }
            } else {
              // 曲が続く場合はスキップ（次回ポーリングまで待機）
              pollingInterval = config.spotifyShortInterval; // 通常間隔で次回確認
              if (config.debugMode) {
                console.log(
                  `[DEBUG] 通常確認: 残り${Math.round(
                    remaining / 1000
                  )}秒 → 次回確認まで${pollingInterval / 1000}秒`
                );
              }
            }
          } else {
            // 時間情報が取得できない場合
            pollingInterval = config.spotifyShortInterval;
            if (config.debugMode) {
              console.log(
                `[DEBUG] 時間情報なし: 次回確認まで${pollingInterval / 1000}秒`
              );
            }
          }
        }

        // 計算された間隔で待機
        await new Promise((resolve) => setTimeout(resolve, pollingInterval));
      } catch (error) {
        if (config.debugMode) {
          console.log(
            `[DEBUG] API取得エラー: ${String(
              error
            )} (${new Date().toLocaleTimeString()})`
          );
        }
        // エラーメッセージも表示しない
        // エラー時は短間隔で再試行
        pollingInterval = config.spotifyShortInterval;
        await new Promise((resolve) => setTimeout(resolve, pollingInterval));
      }
    }
  } catch (error) {
    // 起動失敗時もメッセージを表示しない
    (globalThis as any).Deno.exit(1);
  }
}
main();
