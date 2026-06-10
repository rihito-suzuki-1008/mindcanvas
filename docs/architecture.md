# 2. アーキテクチャ

関連: [requirements.md](requirements.md) ・ [modules-api.md](modules-api.md) ・ [data-model.md](data-model.md)

## 2.1 全体構成

```
┌─────────────────────────────────────────────┐
│ ブラウザ (GAS サンドボックス iframe)              │
│                                               │
│  index.html ─ include() で全 partial をインライン  │
│   ├ css_main (style)                          │
│   ├ CDN: marked / DOMPurify / html-to-image / jsPDF │
│   └ js_* モジュール群（単一グローバルスコープ）        │
│        State Store History Canvas Nodes Edges  │
│        Tree Sections Selection Minimap Search  │
│        Exporter Shortcuts Home App             │
│                                               │
│  localStorage (即時) ◀───────────┐            │
└───────────────│──────────────────│────────────┘
                │ google.script.run │
                ▼                   │
┌─────────────────────────────────────────────┐
│ GAS サーバ (Code.gs) ※スプレッドシートにコンテナバインド │
│   doGet / include / probeDurable               │
│   Drive : driveSave/Load/List/Delete           │
│   Sheet : sheetSave/Load/List/Delete           │
│     scope: drive.file + spreadsheets.currentonly │
│     ├▶ Drive : マイドライブ/MindCanvas/mc_<id>.json │
│     └▶ Sheet : バインド先スプシ/ _mc_data シート    │
└─────────────────────────────────────────────┘
（起動時 probeDurable で Drive 優先・不可なら Sheet を選択）
```

## 2.2 配信モデル（GAS）

- `doGet()` が `HtmlService.createTemplateFromFile('index').evaluate()` を返す。
  - `setTitle('MindCanvas')`
  - `addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')`
  - `setXFrameOptionsMode(ALLOWALL)`
- HtmlService は単一 HTML しか返せないため、CSS/JS は **GAS スクリプトレット `<?!= include('ファイル名'); ?>`** で `index.html` にインライン展開する。
  - `include(filename)` = `HtmlService.createHtmlOutputFromFile(filename).getContent()`
- CDN ライブラリは `index.html` の `<script src>` で読み込む（サンドボックス iframe から外部スクリプト読込は可）。

### CDN 依存
| ライブラリ | バージョン | 用途 | グローバル |
|---|---|---|---|
| marked | @12 | Markdown→HTML | `marked` |
| DOMPurify | @3 | HTML サニタイズ | `DOMPurify` |
| html-to-image | @1.11.11 | DOM→PNG | `htmlToImage` |
| jsPDF | 2.5.1 | PDF 生成 | `jspdf.jsPDF` |

## 2.3 レンダリング方式（DOM + SVG ハイブリッド）

| レイヤ | 要素 | 座標系 |
|---|---|---|
| `#canvas-bg` | グリッド背景（CSS background） | スクリーン（pan/zoom に追従して bg-position/size を更新） |
| `#world` | `transform: translate(x,y) scale(z)` を当てる親 | ― |
| └ `#sections-layer` | セクション `div.section` | ワールド |
| └ `#edges-svg` | `<g id="branch-g">`（枝） + `<g id="edges-g">`（エッジ）+ 矢印 marker | ワールド |
| └ `#nodes-layer` | ノード `div.node`、エッジラベル | ワールド |
| `#overlay` | マーキー矩形・接続プレビュー線 | スクリーン（stage ローカル） |

**設計判断**：ノード内のリッチテキスト（Markdown）編集を canvas で実装すると独自エディタが必要で過大。DOM ノードを採用し、表示は marked、編集は textarea で扱う。エッジ/枝のみ SVG path。

### 再描画戦略（リコンサイル）
- `App.render()` がアクティブシートを描画。各モジュールは **id をキーに DOM 要素を再利用**し、存在しない要素を生成・不要な要素を削除する（全消し再生成はしない）。
- 編集中ノードは `Nodes.editingId` で保護し、内容を上書きしない（textarea が消えない）。
- ドラッグ中は `App.render()` を介さず、該当要素の位置のみ更新（`Nodes.applyPositions()` + ツリー型は `Edges.renderBranches()` + `Edges.render()`）。

### `App.render()` の処理順
```
tree モード: Tree.computeVisibility → Nodes.render → Tree.relayout → Nodes.applyPositions
freeform   : Nodes.render
共通       : (tree)Edges.renderBranches / (free)clearBranches
            → Edges.render → Sections.render → Canvas.apply(=transform/grid/minimap)
            → updateSheetTabs → updateAlignBar → History.update
```

## 2.4 モジュール構成

すべて単一グローバルスコープに `const` 宣言（複数 `<script>` は同一グローバル lexical 環境を共有）。相互参照は**実行時のみ**（定義順非依存）。`App.init()` が最後に全モジュールを初期化。

| モジュール | ファイル | 責務 |
|---|---|---|
| `State` | js_state | データモデル・ミューテーション・共通 util |
| `Store` | js_storage | localStorage + durable backend(Drive/Sheet) 抽象・同期ブリッジ |
| `History` | js_history | Undo/Redo（プロジェクト全体スナップショット） |
| `Canvas` | js_canvas | pan/zoom/grid/snap/座標変換/fit |
| `Nodes` | js_nodes | ノード CRUD・Markdown・編集・ドラッグ・リサイズ |
| `Edges` | js_edges | エッジ・枝の描画、ハンドルからの接続作成 |
| `Tree` | js_tree | ツリー自動レイアウト・Tab/Enter・折りたたみ・再ペアレント |
| `Sections` | js_sections | セクションの描画・移動・リサイズ・矩形ドロー |
| `Selection` | js_selection | 選択・マーキー・整列/分配・グループ化 |
| `Minimap` | js_minimap | 全体俯瞰描画・クリックナビ |
| `Search` | js_search | 全シート検索・ハイライト・ジャンプ |
| `Exporter` | js_export | PNG/PDF/Markdown/Mermaid |
| `Shortcuts` | js_shortcuts | グローバルキーボード操作 |
| `Home` | js_home | ホーム画面・新規モーダル |
| `App` | js_app | ルーティング・描画統括・ツール・タブ・コピペ・UI 結線 |

詳細な公開 API は [modules-api.md](modules-api.md) を参照。

## 2.5 ディレクトリ構成

```
mindcanvas/
├ .clasp.json            # 各自で作成（rootDir: src、scriptId は公開しない）
├ src/                   # ← clasp push 対象（GASに上がる）
│  ├ appsscript.json     # runtime/webapp/oauthScopes(drive.file + spreadsheets.currentonly)
│  ├ Code.gs             # サーバ: doGet/include/probeDurable/drive*/sheet*
│  ├ index.html          # シェル + include + CDN
│  ├ css_main.html       # 全 CSS
│  └ js_*.html           # 各モジュール（<script> でラップ）
├ docs/                  # ← 本仕様書（push 対象外）
├ build_local.js         # ローカル検証用ビルダ（push 対象外）
├ local_preview.html     # 生成物（push 対象外）
```

> `clasp` は `src/` のみを push する。`docs/` `build_local.js` `local_preview.html` は GAS に上がらない。
