# Niji Radio

Niji Radioは、複数のユーザー間で音楽を同期して再生できるWeb アプリケーションです。Cloudflare Workersとその Durable Objects を利用して、リアルタイムな同期を実現しています。

## 主な機能

- 複数ユーザー間での音楽の同期再生
- プレイリストの動的管理（追加、削除、クリア）
- WebSocketを使用したリアルタイム同期
- ブラウザでの音楽再生制御
- 残り時間と次の曲への切り替え時間の表示

## 技術スタック

- **Runtime**: Cloudflare Workers
- **State Management**: Durable Objects
- **Framework**: Hono
- **開発ツール**: Wrangler

## システム構成

### バックエンド (MusicSyncObject)

MusicSyncObjectは以下の機能を提供します：

- プレイリストの動的管理
  - 新しい曲の追加
  - 再生済み曲の自動削除
  - プレイリストの完全クリア
- 再生状態の同期
- WebSocket接続の管理
- トラック切り替えの自動化

### フロントエンド

- シンプルなHTML/JavaScript実装
- WebSocket接続による同期
- ブラウザのAudio APIを使用した音楽再生
- 残り時間と次の曲の切り替え時間のリアルタイム表示

## API仕様

### HTTP エンドポイント

#### GET /
- 説明: メインのWebインターフェースを提供
- レスポンス: HTML

#### POST /api/setPlaylist
- 説明: プレイリストを設定
- 動作: 既存のプレイリストを新しいプレイリストで置き換える
- リクエストボディ:
```json
[
  {
    "url": "音楽ファイルのURL",
    "duration": 再生時間（ミリ秒）
  }
]
```

#### POST /api/addToPlaylist
- 説明: プレイリストに曲を追加
- 動作: 既存のプレイリストに新しい曲を追加
- リクエストボディ:
```json
[
  {
    "url": "音楽ファイルのURL",
    "duration": 再生時間（ミリ秒）
  }
]
```

#### POST /api/clearPlaylist
- 説明: プレイリストを完全にクリア
- 動作: 全ての曲を削除し、再生を停止
- リクエストボディ: 不要

#### GET /api/getPlaylist
- 説明: 現在のプレイリストを取得
- レスポンス: プレイリスト情報（JSON）

### WebSocket通信

#### サーバーからクライアントへのメッセージ

1. 同期メッセージ
```json
{
  "type": "sync",
  "elapsedTime": 経過時間（ミリ秒）,
  "trackUrl": "現在再生中の曲のURL",
  "duration": 曲の長さ（ミリ秒）
}
```

2. トラック変更メッセージ
```json
{
  "type": "changeTrack",
  "trackUrl": "新しい曲のURL",
  "duration": 曲の長さ（ミリ秒）
}
```

## セットアップと実行方法

### 開発環境のセットアップ

```bash
# 依存パッケージのインストール
npm install
```

### ローカル開発

```bash
# 開発サーバーの起動
npm run dev
```

### デプロイ

```bash
# Cloudflare Workersへのデプロイ
npm run deploy
```

## 技術的な詳細

### プレイリスト管理の仕組み

1. 新しい曲の追加
   - POST /api/addToPlaylistで新しい曲を追加
   - 既存のプレイリストの末尾に追加
   - プレイリストが空の場合は即座に再生開始

2. プレイリストの設定
   - POST /api/setPlaylistで新しいプレイリストを設定
   - 既存のプレイリストを新しいプレイリストで置き換え
   - 即座に新しいプレイリストの最初の曲を再生開始

3. 再生済み曲の管理
   - 曲の再生が完了すると自動的にプレイリストから削除
   - 次の曲が自動的に再生開始
   - プレイリストが空になった場合は再生を停止

4. プレイリストのクリア
   - POST /api/clearPlaylistでプレイリストを完全にクリア
   - 現在再生中の曲も停止
   - 全てのクライアントに再生停止を通知

### 同期の仕組み

1. クライアントがWebSocket接続を確立
2. サーバーは現在の再生状態（曲のURL、経過時間、曲の長さ）を送信
3. クライアントは受信した情報に基づいて再生位置を調整
4. 曲が終了すると自動的に次の曲に切り替わり、全クライアントに通知
5. 残り時間と次の曲への切り替え時間をリアルタイムに表示

### Durable Objectsの利用

- プレイリストの永続化
- 再生状態の管理
- WebSocket接続の管理
- トラック切り替えのスケジューリング
