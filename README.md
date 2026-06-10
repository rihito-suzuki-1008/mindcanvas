# MindCanvas

MindCanvas は、アイデアを無限キャンバス上で整理するための Google Apps Script 製 Web アプリです。

XMind のような構造化マインドマップと、FigJam のような自由配置ホワイトボードの中間を目指しています。

- **ツリー型**: 右方向に展開するロジックツリーとして整理する
- **フリーフォーム**: アイデア、図解、メモを自由に配置する

プロジェクトは `localStorage` に即時保存され、環境に応じて Google Drive またはコンテナバインドされた Google スプレッドシートへバックアップできます。

## 主な機能

- 複数プロジェクト / 複数シート
- ツリー型 / フリーフォームのキャンバスモード
- Markdown 対応ノードとメモ欄
- ノード間の接続線、矢印、ラベル
- ズーム、パン、グリッド、スナップ、ミニマップ、全体表示
- 複数選択、整列、分配、グループ化、セクション、Undo / Redo
- 全シート横断検索
- PNG / PDF / Markdown / Mermaid エクスポート
- Drive 優先、利用できない場合はスプレッドシートへ倒す保存バックエンド

## 技術構成

- Google Apps Script
- Vanilla HTML / CSS / JavaScript
- SVG によるエッジ・枝線描画
- DOM ノードによるリッチテキスト表示・編集
- CDN 経由の `marked`, `DOMPurify`, `html-to-image`, `jsPDF`

## ディレクトリ構成

```text
src/                 clasp で push する GAS ソース
docs/                要件、設計、データモデル、開発手順などのドキュメント
build_local.js       ローカルプレビュー用ビルドスクリプト
```

Google Apps Script は単一 HTML として配信するため、`src/index.html` から `src/` 配下の CSS / JS partial を GAS scriptlet で読み込む構成です。

## ローカルプレビュー

GAS にデプロイせず、ブラウザで動作確認できます。

```bash
node build_local.js
```

その後、リポジトリルートで静的サーバを起動します。

```bash
python3 -m http.server 8765
```

ブラウザで次を開きます。

```text
http://localhost:8765/local_preview.html
```

URL に `?backend=sheet` を付けると、ローカルスタブ環境でスプレッドシート保存経路を検証できます。

## Google Apps Script へのデプロイ

このリポジトリには `.clasp.json` を含めていません。各自で Apps Script プロジェクトを作成し、生成された `scriptId` はローカルにだけ保持してください。

スプレッドシートにバインドしたプロジェクトを作る例:

```bash
clasp create --type sheets --title "MindCanvas"
```

リポジトリルートに `.clasp.json` を作成します。

```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "src"
}
```

push / deploy します。

```bash
clasp push -f
clasp deploy --description "MindCanvas"
```

詳しい手順は [docs/development.md](docs/development.md) を参照してください。

## Google OAuth スコープ

標準のマニフェストでは、次のスコープを要求します。

- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/spreadsheets.currentonly`

`drive.file` は、このアプリが作成した Drive ファイルのみを作成・管理するために使います。
`spreadsheets.currentonly` は、スプレッドシートにバインドした保存バックエンドで使います。

Drive を利用できない環境では、`src/appsscript.json` から `drive.file` スコープを削除してください。その場合、スプレッドシートにバインドしてデプロイすると、MindCanvas はスプレッドシート保存経路へフォールバックします。

## ドキュメント

- [要件定義](docs/requirements.md)
- [アーキテクチャ](docs/architecture.md)
- [データモデル](docs/data-model.md)
- [UI・操作・ショートカット](docs/ui-and-shortcuts.md)
- [モジュール API](docs/modules-api.md)
- [保存・同期](docs/storage-and-sync.md)
- [エクスポート](docs/export.md)
- [開発・ビルド・デプロイ](docs/development.md)

## ライセンス

MIT
