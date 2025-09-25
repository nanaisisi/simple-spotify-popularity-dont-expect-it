/**
 * メインサーバーエントリーポイント
 * ServerAppクラスを使用してサーバーを開始
 */

import { ServerApp } from "./server/server-app.ts";

// サーバーアプリケーションを作成して開始
try {
  const app = new ServerApp();
  await app.start();
} catch (error) {
  console.error("サーバー起動に失敗:", error);
  (globalThis as any).Deno.exit(1);
}
