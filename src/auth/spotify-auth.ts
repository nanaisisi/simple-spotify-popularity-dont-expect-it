import { encode } from "https://deno.land/std@0.140.0/encoding/base64.ts";

/**
 * Spotify認証クラス
 * OAuth2認証とトークン管理を担当
 */
export class SpotifyAuth {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private config: any;
  private tokenFilePath = "spotify_tokens.json";

  // 未ログイン警告の状態管理
  private loginWarningCount = 0;
  private lastLoginWarningTime = 0;

  constructor(config: any) {
    this.config = config;
    this.loadTokens();
  }

  /**
   * トークンをファイルから読み込み
   */
  private loadTokens(): void {
    try {
      const tokenData = Deno.readTextFileSync(this.tokenFilePath);
      const tokens = JSON.parse(tokenData);
      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
      this.tokenExpiresAt = tokens.tokenExpiresAt;
    } catch (error) {
      // ファイルが存在しないか無効な場合はトークンなしで開始
    }
  }

  /**
   * トークンを再読み込み
   */
  public reloadTokens(): void {
    this.loadTokens();
  }

  /**
   * トークンをファイルに保存
   */
  private saveTokens(): void {
    try {
      const tokens = {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        tokenExpiresAt: this.tokenExpiresAt,
      };
      Deno.writeTextFileSync(
        this.tokenFilePath,
        JSON.stringify(tokens, null, 2)
      );
    } catch (error) {
      console.error("トークンの保存に失敗:", error);
    }
  }

  /**
   * 認証状態を取得
   */
  get isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  /**
   * アクセストークンを取得
   */
  get token(): string | null {
    return this.accessToken;
  }

  /**
   * アクセストークンをリフレッシュ
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      console.error("リフレッシュトークンが利用できません");
      return;
    }

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          encode(`${this.config.clientId}:${this.config.clientSecret}`),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`トークンリフレッシュエラー: ${body}`);
      // 再ログインを強制する可能性あり
      this.accessToken = null;
      this.refreshToken = null;
      return;
    }

    const data = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    console.log("アクセストークンをリフレッシュしました");

    // リフレッシュトークンが更新された場合も保存
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }
    this.saveTokens();
  }

  /**
   * OAuthコールバックを処理
   * @param code 認証コード
   * @returns 成功したかどうか
   */
  async handleCallback(code: string): Promise<boolean> {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          encode(`${this.config.clientId}:${this.config.clientSecret}`),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`認証エラー: ${body}`);
      return false;
    }

    const data = await res.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

    // ログイン成功時に警告カウントをリセット
    this.loginWarningCount = 0;
    this.lastLoginWarningTime = 0;
    console.log("✓ Spotify認証成功！");

    // トークンをファイルに保存
    this.saveTokens();

    return true;
  }

  /**
   * 認証URLを生成
   * @returns 認証URL
   */
  getAuthUrl(): string {
    const scope = "user-read-currently-playing";
    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", this.config.clientId);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("redirect_uri", this.config.redirectUri);
    return authUrl.toString();
  }

  /**
   * トークンの有効期限をチェック
   */
  checkTokenExpiration(): void {
    if (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt) {
      this.refreshAccessToken();
    }
  }

  /**
   * ログインワーニングを表示
   */
  showLoginWarning(): void {
    const now = Date.now();
    if (
      this.loginWarningCount < this.config.loginWarningMaxCount &&
      now - this.lastLoginWarningTime > this.config.loginWarningInterval
    ) {
      this.loginWarningCount++;
      this.lastLoginWarningTime = now;
      console.warn(
        `⚠️  Spotifyが認証されていません！ (警告 ${this.loginWarningCount}/${this.config.loginWarningMaxCount})`
      );
      console.warn(
        `   認証するには http://127.0.0.1:${this.config.port}/login にアクセスしてください`
      );
      console.warn(`   認証なしではトラック情報が取得できません。`);
    }
  }
}
