# 3. データモデル

関連: [architecture.md](architecture.md) ・ [storage-and-sync.md](storage-and-sync.md)

すべて plain JSON。`State`（js_state）が生成・変更を担う。

## 3.1 エンティティ関係

```
Project 1 ─── * Sheet 1 ─┬─ * Node
                          ├─ * Edge   (from/to は Node.id)
                          └─ * Section
```

## 3.2 Project

```js
{
  id: "pj_xxx",            // 一意ID
  name: "無題のプロジェクト",
  mode: "tree" | "freeform",   // 作成後変更不可
  createdAt: 1717800000000,    // epoch ms
  updatedAt: 1717800000000,    // 変更のたび更新（同期の競合解決キー）
  activeSheetId: "sh_xxx",
  prefs: { grid: true, snap: true },
  sheets: [ Sheet, ... ]
}
```

## 3.3 Sheet

```js
{
  id: "sh_xxx",
  name: "シート1",
  nodes:   { [nodeId]: Node },      // id をキーにしたマップ
  edges:   { [edgeId]: Edge },
  sections:{ [sectionId]: Section },
  viewport:{ x: 120, y: 90, zoom: 1 }  // pan オフセット(px) と zoom 率
}
```
- 新規シートのツリーモードでは、ルートノード（`text: '# 中心テーマ'`, `x:80, y:300`）を 1 つ自動生成。

## 3.4 Node

```js
{
  id: "n_xxx",
  x: 0, y: 0,         // ワールド座標（左上）
  w: 200,             // 幅（可変）。高さは内容に追従（model に持たない）
  h: 0,               // 予備（実高さは DOM の offsetHeight を使用）
  kind: "tree" | "free",
  type: "text" | "image" | "plainText", // 省略時は text 扱い
  text: "アイデア",    // Markdown 文字列
  memo: "",           // サブメモ（プレーン）
  parentId: null,     // ツリー階層（freeform では常に null）
  collapsed: false,   // ツリー折りたたみ
  groupId: null,      // グループ識別子（同値の Node は一緒に移動・選択）
  image: null,        // type==="image" のとき ImageAsset
  style: {            // 省略可。未指定項目はCSS既定値
    stroke: "#d7dde7",
    fill: "#ffffff",
    text: "#1d2430"
  }
}
```

画像ノードは通常の Node として扱う。`kind` は `free`、`type` は `image`、`text` にはファイル名を入れる。画像本文編集は行わず、移動・リサイズ・選択・削除・接続は通常ノードと同じ。

プレーンテキスト要素も通常の Node として保存する。`kind` は `free`、`type` は `plainText` とし、枠線・塗り・接続ハンドル・メモを表示しない。本文は `text` に保存する。

```js
{
  src: "data:image/jpeg;base64,...", // 保存用Data URL
  name: "sample.jpg",
  mime: "image/jpeg",
  originalSize: 1234567,
  width: 2400, height: 1600 // 元画像の自然サイズ
}
```

<!-- 2026-06-15: 画像アップロードはDrive追加APIを増やさず、プロジェクトJSON内の画像ノードとして保存する。ラスター画像はクライアント側で長辺1600px以内に縮小する。 -->
<!-- 2026-06-15 / #18: 色付けは `style.stroke` / `style.fill` / `style.text` として保存する。 -->
<!-- 2026-06-17 / #23: 枠無しのプレーンテキストは `type: "plainText"` のfreeノードとして保存する。 -->

| transient（保存しない / 実行時のみ） | 意味 |
|---|---|
| `_hidden` | 折りたたみ祖先の配下で非表示（`Tree.computeVisibility` が設定） |
| `_fresh` | 生成直後フラグ（最初の編集で全選択させ、消す） |

> 永続化時は `JSON.stringify(project)` のため `_hidden`/`_fresh` も含まれ得るが、ロード時に再計算・上書きされるため実害なし。ペースト時は明示的に削除している。

## 3.5 Edge（ユーザー作成の接続）

```js
{
  id: "e_xxx",
  from: "n_aaa",      // 始点 Node.id
  to:   "n_bbb",      // 終点 Node.id
  fromSide: "t"|"r"|"b"|"l"|null,  // 始点の接続辺（null=自動）
  toSide:   "t"|"r"|"b"|"l"|null,  // 終点の接続辺（null=自動）
  kind: "straight" | "curve",      // curve=遠距離向けに制御点を大きく
  label: "",          // 接続ラベル（改行可）
  directed: true      // 矢印の有無
}
```
- 同一 `from→to` の重複追加は不可（既存を返す）。`from===to` は不可。
- `fromSide/toSide` が null の場合、両ノード中心の相対位置から自動決定（`Edges.autoSides`）。
- `label` は複数行を保持できる。Mermaid export では改行を `<br/>` として出力し、Mermaid import では `<br/>` を改行へ戻す。

## 3.6 Section

```js
{
  id: "sec_xxx",
  x: 0, y: 0,         // ワールド座標（左上）
  w: 300, h: 200,
  title: "セクション",
  style: {            // 省略可。未指定項目はCSS既定値
    stroke: "#d7dde7",
    fill: "#ffffff",
    text: "#1d2430"
  }
}
```
- 移動時、ドラッグ開始時点で**矩形内に中心が入るノード**を内包扱いとして一緒に移動。
- セクション本体の空き領域、タイトルバーのどちらからでもドラッグ移動できる。ノードは上位レイヤーにあるため、ノード上のドラッグはノード操作を優先する。
- Mermaid export では `subgraph` として出力する。重なったセクションに同一ノードが入る場合は、描画順で最初のセクションへ所属させる。

## 3.7 ツリーの「枝」について
- 枝（親子の接続線）は**データに持たない**。`parentId` から `Edges.renderBranches()` が毎描画で生成する。
- 永続化されるのは `parentId` のみ。

## 3.8 主要定数（js_state）

| 定数 | 値 | 用途 |
|---|---|---|
| `GRID` | 20 | グリッド間隔・スナップ単位・矢印キー移動量 |
| `NODE_W` | 200 | ノード既定幅 |
| `FREE_NODE_W` | 170 | フリーフォーム新規ノード既定幅 |
| `FREE_NODE_H` | 150 | フリーフォーム新規ノード既定高さ |
| `MIN_NODE_W` | 120 | ノードの最小幅 |
| `MIN_NODE_H` | 80 | フリーフォームノードの最小高さ |
| `H_GAP` | 64 | ツリー親子の水平間隔 |
| `V_GAP` | 18 | ツリー兄弟の垂直間隔 |

## 3.9 ID 採番
`uid(prefix)` = `prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7)`
プレフィックス: `pj`(project) / `sh`(sheet) / `n`(node) / `e`(edge) / `sec`(section) / `g`(group)。
