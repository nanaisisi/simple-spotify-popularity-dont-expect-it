// Spotifyオーバーレイアプリケーションの設定ファイル
import { parse as parseToml } from "https://deno.land/std@0.213.0/toml/mod.ts";

/**
 * 設定インターフェース
 */
export interface Config {
  clientId: string; // SpotifyクライアントID
  clientSecret: string; // Spotifyクライアントシークレット
  redirectUri: string; // OAuthリダイレクトURI
  port: number; // サーバーポート
  pollingInterval: number; // ポーリング間隔（ミリ秒）
  // APIレート制限
  spotifyApiLimit: number; // Spotify API制限回数
  spotifyRateLimitWindow: number; // レート制限ウィンドウ（ミリ秒）
  // 警告設定
  loginWarningInterval: number; // ログインワーニング間隔
  loginWarningMaxCount: number; // ログインワーニング最大回数
  // ポーリング間隔
  longPollingThreshold: number; // 長時間ポーリングしきい値
  spotifyShortInterval: number; // Spotify短間隔ポーリング
  spotifyLongInterval: number; // Spotify長間隔ポーリング
  // デバッグ設定
  debugMode: boolean; // デバッグモード有効化
}

/**
 * TOMLファイルから設定を読み込み、デフォルト値を適用
 */
export function loadConfig(): Config {
  let configData: any = {};

  // config.tomlファイルを優先的に読み込み、フォールバックとしてconfig_example.tomlを使用
  try {
    const tomlContent = Deno.readTextFileSync("config.toml");
    configData = parseToml(tomlContent);
  } catch (error) {
    try {
      const tomlContent = Deno.readTextFileSync("config_example.toml");
      configData = parseToml(tomlContent);
    } catch (exampleError) {
      // デフォルト値を使用
    }
  }

  // TOMLから値を取得するかデフォルト値を使用
  const port = configData.server?.port || 8081;

  return {
    clientId: configData.spotify?.client_id || "",
    clientSecret: configData.spotify?.client_secret || "",
    redirectUri:
      configData.server?.redirect_uri || `http://127.0.0.1:${port}/callback`,
    port: port,
    pollingInterval: configData.server?.polling_interval || 5000,
    // APIレート制限
    spotifyApiLimit: configData.api?.spotify_api_limit || 30,
    spotifyRateLimitWindow: configData.api?.spotify_rate_limit_window || 60000,
    // 警告設定
    loginWarningInterval: configData.warnings?.login_warning_interval || 120000,
    loginWarningMaxCount: configData.warnings?.login_warning_max_count || 2,
    // ポーリング間隔
    longPollingThreshold: configData.polling?.long_polling_threshold || 30000,
    spotifyShortInterval: configData.polling?.spotify_short_interval || 15000,
    spotifyLongInterval: configData.polling?.spotify_long_interval || 60000,
    // デバッグ設定
    debugMode: configData.debug?.debug_mode || false,
  };
}

/**
 * 必須の設定項目が存在することを検証
 */
export function validateConfig(config: Config): void {
  if (!config.clientId) {
    throw new Error("SPOTIFY_CLIENT_ID 環境変数が必要です");
  }
  if (!config.clientSecret) {
    throw new Error("SPOTIFY_CLIENT_SECRET 環境変数が必要です");
  }
}
