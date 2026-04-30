# Discord ComVis

Discord チャット履歴から「誰が誰の問題を解決したか」を重み付き有向グラフで可視化するWebアプリ。

## セットアップ

### 1. Discord Bot 作成

1. https://discord.com/developers/applications でアプリを作成
2. Bot タブ → **MESSAGE CONTENT INTENT** と **SERVER MEMBERS INTENT** を有効化
3. OAuth2 → URL Generator → `bot` スコープ → 権限: `Read Messages`, `Read Message History`, `View Members`
4. Bot トークンをコピーしておく

### 2. 環境変数

```bash
cd discord-comvis
cp .env.example .env
# .env を編集して DISCORD_BOT_TOKEN と GEMINI_API_KEY を設定
```

### 3. バックエンド

```bash
cd backend
pip install -r requirements.txt
python -m spacy download ja_ginza   # GiNZA 日本語モデル
uvicorn main:app --reload --port 8000
```

> **Windows + MeCab:** MeCab はオプション。GiNZA 単体で動作します。
> MeCab を使う場合は https://github.com/ikegami-yukino/mecab/releases からバイナリをインストール後 `pip install mecab-python3`

### 4. フロントエンド

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## 使い方

1. **設定** ページで Discord Bot Token と Gemini API Key を入力・保存
2. サーバーを再起動（トークン変更を反映）
3. **分析実行** ページでサーバーを選択 → `パイプライン実行`
4. **グラフ** ページで有向グラフを確認

## アーキテクチャ

```
Browser (React + D3.js)
    │ HTTP / WebSocket
FastAPI (Python)
    ├── collector/    Discord API → SQLite
    ├── pipeline/     Phase 1 → 2 Fast/Slow → 2.5 → 3 → 4
    ├── algorithms/   形態素解析 / ベクトル演算 / グラフ計算
    └── routers/      REST API + WebSocket
```

## 技術スタック

| 役割 | 技術 |
|------|------|
| バックエンド | FastAPI + SQLAlchemy + SQLite |
| Discord | discord.py 2.x |
| NLP | GiNZA (spaCy) + Gemini API |
| グラフ計算 | NetworkX |
| フロントエンド | React + TypeScript + Vite |
| グラフ描画 | D3.js |
| スタイリング | Tailwind CSS |
