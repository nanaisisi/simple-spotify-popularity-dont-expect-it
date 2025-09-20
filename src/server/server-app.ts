/**
 * Server Application Manager - サーバーアプリケーションの管理
 * コンポーネントの初期化とサーバー起動を担当
 */

import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { loadConfig, validateConfig } from "../../config.ts";
import { SpotifyAuth } from "../auth/spotify-auth.ts";
import { SpotifyPlayer } from "../media/spotify-player.ts";
import { RouteHandler } from "./route-handler.ts";

export class ServerApp {
  private config!: any;
  private spotifyAuth!: SpotifyAuth;
  private spotifyPlayer!: SpotifyPlayer;
  private routeHandler!: RouteHandler;

  constructor() {
    this.initializeComponents();
  }

  /**
   * 全コンポーネントを初期化
   */
  private initializeComponents() {
    // 設定を読み込み
    this.config = loadConfig();
    validateConfig(this.config);

    // コンポーネントを初期化
    this.spotifyAuth = new SpotifyAuth(this.config);
    this.spotifyPlayer = new SpotifyPlayer(this.spotifyAuth, this.config);
    this.routeHandler = new RouteHandler(this.config, this.spotifyAuth);

    console.log("✓ All components initialized successfully");
  }

  /**
   * サーバーを開始
   */
  async start() {
    // リクエストハンドラーを設定
    const handler = (req: Request) => this.routeHandler.handleRequest(req);

    // サーバーを開始
    serve(handler, { port: this.config.port });

    // 開始メッセージを表示
    this.displayStartupMessage();
  }

  /**
   * 開始メッセージを表示
   */
  private displayStartupMessage() {
    console.log(`Spotify Popularity CLI Server is running on:`);
    console.log(`  - Local:   http://127.0.0.1:${this.config.port}/`);
    console.log(`  - Network: http://localhost:${this.config.port}/`);
    console.log(`\nMedia Source: Spotify`);
    console.log(`\nTo get started:`);
    console.log(
      `  1. Open http://127.0.0.1:${this.config.port}/ in your browser`
    );
    console.log(
      `  2. 🎵 For Spotify login: http://127.0.0.1:${this.config.port}/login`
    );
    console.log(`  3. Run the CLI to see track popularity`);
  }
}
