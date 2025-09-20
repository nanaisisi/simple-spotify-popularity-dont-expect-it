/**
 * HTTP Route Handlers - HTTPリクエストのルーティング処理
 * 各エンドポイントの処理を担当
 */

import { SpotifyAuth } from "../auth/spotify-auth.ts";
import { generateFavicon } from "../utils/helpers.ts";

export class RouteHandler {
  constructor(private config: any, private spotifyAuth: SpotifyAuth) {}

  /**
   * メインルートハンドラー
   */
  async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    switch (url.pathname) {
      case "/login":
        return this.handleLogin();

      case "/callback":
        return this.handleCallback(url);

      case "/favicon.ico":
        return this.handleFavicon();

      default:
        return await this.handleStaticFiles(req);
    }
  }

  /**
   * Spotify ログインリダイレクト
   */
  private handleLogin(): Response {
    return Response.redirect(this.spotifyAuth.getAuthUrl(), 302);
  }

  /**
   * Spotify コールバック処理
   */
  private async handleCallback(url: URL): Promise<Response> {
    const code = url.searchParams.get("code");
    if (!code) {
      return new Response("Error: No code provided", { status: 400 });
    }

    const success = await this.spotifyAuth.handleCallback(code);
    if (!success) {
      return new Response("Authentication failed", { status: 400 });
    }

    return Response.redirect(`http://127.0.0.1:${this.config.port}/`, 302);
  }

  /**
   * ファビコン
   */
  private handleFavicon(): Response {
    const favicon = generateFavicon();
    return new Response(favicon as any, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  /**
   * 静的ファイル配信
   */
  private async handleStaticFiles(req: Request): Promise<Response> {
    const url = new URL(req.url);
    let filePath = url.pathname;
    // ルートの場合はindex.htmlを返す
    if (filePath === "/" || filePath === "") {
      filePath = "/index.html";
    }
    // パスの正規化
    filePath = `public${filePath}`.replace(/\\+/g, "/");

    try {
      const file = await (globalThis as any).Deno.readFile(filePath);
      const contentType = this.getContentType(filePath);
      return new Response(file, {
        headers: { "Content-Type": contentType },
      });
    } catch {
      return new Response("File not found", { status: 404 });
    }
  }

  /**
   * ファイルパスからContent-Typeを取得
   */
  private getContentType(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "html":
        return "text/html";
      case "css":
        return "text/css";
      case "js":
        return "application/javascript";
      case "json":
        return "application/json";
      case "png":
        return "image/png";
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "ico":
        return "image/x-icon";
      default:
        return "text/plain";
    }
  }
}
