# Spotify Popularity CLI

Spotify で現在再生中の楽曲の人気度を CLI で表示するアプリケーションです。

## 動作環境

- **OS**: Windows 10/11
- **ランタイム**: Deno (最新版推奨)
- **ブラウザ**: Chrome, Firefox, Edge など現代的な Web ブラウザ

## セットアップ

### 1. Spotify アプリケーションの作成

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) にアクセス
2. 新しいアプリケーションを作成
3. Client ID と Client Secret を取得
4. Redirect URI に `http://127.0.0.1:8081/callback` を追加

### 2. 設定ファイルの作成

`config.toml` ファイルをプロジェクトルートに作成し、以下の内容を設定：

````toml
[spotify]
client_id = "あなたのSpotifyクライアントID"
client_secret = "あなたのSpotifyクライアントシークレット"


```toml
[server]
port = 8081
redirect_uri = "http://127.0.0.1:8081/callback"

[spotify]
client_id = ""
client_secret = ""

[polling]
# ポーリング間隔（API制限を考慮して低頻度）
spotify_short_interval = 10000 # Spotify短間隔ポーリング (10秒)
spotify_long_interval = 30000  # Spotify長間隔ポーリング (30秒)
````

#### 設定ファイルの準備

上記の設定例を参考に、あなたの環境に合わせて設定値を更新してください。

> **💡 ヒント**: Windows でファイルをコピーした後、メモ帳や VS Code などで`config.toml`を編集してください。

### 3. 実行

**通常の実行:**

```bash
deno run --allow-net --allow-read --allow-run src/main.ts
```

## 使用方法

### Spotify モード

1. アプリケーションを起動
2. ブラウザで `http://127.0.0.1:8081` にアクセス
3. `/login` エンドポイントで Spotify にログイン
4. WebSocket を使用してリアルタイムで現在再生中の楽曲情報を取得

## 設定オプション

- `polling_interval`: 曲のチェック間隔（ミリ秒、デフォルト: 5000）
- `spotify_api_limit`: API 呼び出し制限（デフォルト: 30 回/分）
- `port`: サーバーポート（デフォルト: 8081）

## ライセンス

Licensed under Apache License 2.0 or MIT License.
