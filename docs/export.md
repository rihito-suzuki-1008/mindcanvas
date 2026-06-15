# 7. エクスポート

関連: [modules-api.md](modules-api.md)

エディタ右上「エクスポート ▾」から PNG / PDF / Markdown / Mermaid。`Exporter.run(kind)` がエントリ。

## 7.1 ラスタ画像（PNG / PDF）共通の撮影手順 `Exporter.capture()`

1. 編集中なら確定（`Nodes.commitEdit()`）、選択・エッジ選択を解除。
2. `Canvas.fit()` で全要素が収まるよう一時的にズーム/位置調整。
3. `#stage` に `.exporting` クラスを付与し、UI（グリッド背景・ズームコントロール・ミニマップ・検索ボックス・オーバーレイ）を非表示化。
4. 200ms 待機後 `htmlToImage.toPng(#stage, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true })`。
5. 撮影後、ビューポートを元に戻し `.exporting` を解除。
6. dataURL を返す（失敗時は toast 表示で null）。

> 撮影対象は「現在シートの全体（fit 表示）」。画面外を含むボード全体が 1 枚に入る。

### PNG `Exporter.png()`
- `capture()` の dataURL を `<プロジェクト名>.png` としてダウンロード。

### PDF `Exporter.pdf()`
- `capture()` の PNG を `Image` で読み込み、`jsPDF` で 1 ページに配置。
- 用紙：画像のアスペクトで `landscape`/`portrait` 自動判定。`unit: 'pt'`、`format: [w, h]`（`w = img.width*0.5`, `h = img.height*0.5`：pixelRatio 2 を CSS ピクセル相当に換算）。
- `<プロジェクト名>.pdf` として保存。

## 7.2 Markdown `Exporter.markdown()`

- **プロジェクト全シート**を出力。
- 構造：
  - `# <プロジェクト名>`
  - シートごとに `## <シート名>`
  - **ツリーモード**：ルートから再帰し、深さに応じてネストした箇条書き。メモは `> 引用` で 1 段下げ。
  - **フリーフォーム**：セクションがある場合は `### セクション` にまとめ、セクション外ノードは `### セクション外` に列挙。続けて `**接続**` 見出しの下に `- A → B : ラベル` を列挙。
  - **セクション**：矩形内に中心が入るノードを所属ノードとして扱う。重なったセクションでは先に並ぶセクションを優先。
- ラベル整形 `label(n)`：本文 1 行目から先頭の `#`（見出し）・`- `/`* `/`+ `（箇条書き）・`**`（太字）・`` ` ``（コード）を除去。空なら `(空)`。

### 出力例（ツリー）
```markdown
# 企画ブレスト

## シート1

- 中心テーマ
  - 整理
    - グルーピング
  - アクション
    - 担当を決める
  - アイデア発散
    - 付箋を書く
    - KJ法でまとめる
```

## 7.3 Mermaid `Exporter.mermaid()`

- **現在のシートのみ**を `flowchart LR` として出力（Mermaid は 1 ダイアグラム＝1 図のため）。
- ノード：`<sid>["<label>"]`。`sid = 'n_' + id.replace(/[^a-zA-Z0-9_]/g,'')`。ラベルは `"`→`'`、`[ ]` 除去。
- 接続：
  - ツリーモードは `parentId` から `親sid --> 子sid`。
  - 明示エッジは `from -->|ラベル| to`（ラベルが無ければ `-->`）。
- セクションは `subgraph <secid>["<セクション名>"] ... end` として出力する。
- ノード/セクションに色指定がある場合は、Mermaid の `style <id> fill:<色>,stroke:<色>,color:<色>` 行として出力する。Markdownには色指定を出力しない。
- 出力テキストはモーダル（`showText`）に表示し、コピー / `.mmd` ダウンロード可能。

<!-- 2026-06-15 / #18: Mermaid export に Node/Section の style を反映。 -->

### 出力例
```
flowchart LR
  n_n_aaa["中心テーマ"]
  n_n_bbb["アイデア発散"]
  n_n_aaa --> n_n_bbb
```

## 7.4 テキスト出力モーダル `Exporter.showText(title, text, ext)`
- 読み取り専用 textarea にテキストを表示。
- [コピー]（`execCommand('copy')`）/ [ダウンロード(.ext)] / [閉じる]。
- マスク外クリックで閉じる。

## 7.5 ダウンロードヘルパー
- `downloadURL(url, filename)`：`<a download>` を生成してクリック。
- `downloadText(text, filename, mime)`：`Blob` から Object URL を作りダウンロード。
