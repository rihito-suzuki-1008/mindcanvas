# 5. モジュール公開 API

関連: [architecture.md](architecture.md)

各モジュールはグローバル `const` オブジェクト。主要な公開メンバーを示す（`_` 始まりや内部ヘルパーは省略）。

## State（js_state）— 状態とミューテーション
| メンバー | 説明 |
|---|---|
| `project` | 現在のプロジェクト（null=未オープン） |
| `GRID, NODE_W, H_GAP, V_GAP` | 定数 |
| `activeSheet()` | アクティブシートを返す |
| `prefs()` | `project.prefs`（grid/snap） |
| `nodeDefaults(mode)` | モード別の新規ノード初期サイズ（ツリー型は横長、フリーフォームは正方形寄り） |
| `mkNode(props)` / `blankSheet(id,name,mode)` / `newProject(name,mode)` | 生成 |
| `addSheet(name)` / `removeSheet(id)` / `renameSheet(id,name)` / `setActiveSheet(id)` | シート操作（commit 経由） |
| `addNode(props)` / `getNode(id)` / `removeNodes(ids)` | ノード（removeNodes はツリー子孫と関連エッジも除去） |
| `addEdge(from,to,opts)` / `removeEdges(ids)` | エッジ |
| `addSection(props)` / `removeSections(ids)` | セクション |
| `touch()` | updatedAt 更新 + 保存スケジュール |
| `commit(fn)` | `History.push()` → fn → touch → `App.render()` |
| `touchRender()` | touch + render（履歴は積まない） |

> **ミューテーションの作法**：離散操作は `State.commit(fn)`。ドラッグ等の連続操作はジェスチャ開始時に `mcClone(State.project)` を控え、終了時に `History.pushSnapshot(snap)` + `State.touchRender()`。

## Store（js_storage）— 永続化（backend 抽象）
| メンバー | 説明 |
|---|---|
| `backend` | `'drive'` | `'sheet'` | `'local'`（起動時に確定） |
| `gas()` | `google.script.run` 利用可否 |
| `initBackend(cb)` | `probeDurable` で Drive 優先・不可なら Sheet・両不可なら local を選択 |
| `listLocal()` / `loadLocal(id)` / `saveLocalNow(p)` / `removeLocal(id)` | localStorage 直接 |
| `saveAndBackup(p)` | local 保存 + durable へ即バックアップ（複製/新規用） |
| `scheduleSave()` | 350ms デバウンス → local 保存 → `scheduleDurableSync()` |
| `scheduleDurableSync()` / `durableSyncNow()` | 2200ms デバウンス → `_durableSave` |
| `_durableSave/_durableLoad/_durableList/_durableDelete` | `backend` で `drive*`/`sheet*` を呼び分け |
| `loadProject(id,cb)` | local と durable の新しい方を `cb(project)` |
| `refreshFromDrive(cb)` | durable index を local にマージ（名称は踏襲） |
| `deleteProject(id)` | local + durable 削除 |
| `setStatus(kind)` | 同期ピル更新（backend 名を併記） |

## History（js_history）— Undo/Redo
| メンバー | 説明 |
|---|---|
| `undo, redo, LIMIT(=100)` | スタックと上限 |
| `reset()` | クリア |
| `push()` | 現在の project クローンを undo に積む |
| `pushSnapshot(snap)` | 外部で控えた pre-mutation スナップショットを積む |
| `doUndo()` / `doRedo()` | 巻き戻し / やり直し（selection を prune、render+apply） |

## Canvas（js_canvas）— ビューポート
| メンバー | 説明 |
|---|---|
| `vp()` | アクティブシートの viewport |
| `apply()` | transform + grid 背景 + zoom ラベル + minimap |
| `screenToWorld(cx,cy)` / `worldToLocal(wx,wy)` | 座標変換 |
| `snap(v)` | スナップ有効時 GRID 丸め |
| `contentBBox()` | 全ノード/セクションのワールド bbox |
| `fit()` | 全体表示 |
| `centerOn(wx,wy,zoom?)` | 指定ワールド点を中央へ |
| `panBy(dx,dy)` / `zoomAt(cx,cy,factor)` / `zoomStep(dir)` | パン/ズーム（zoom clamp 0.15〜4） |
| `startPan(e,onClick)` | パンジェスチャ。`onClick` はドラッグ移動が発生しなかった場合のみ実行 |

## Nodes（js_nodes）— ノード描画/編集
| メンバー | 説明 |
|---|---|
| `els` / `editingId` | DOM 要素マップ / 編集中 ID |
| `md(text)` | Markdown→サニタイズ済 HTML |
| `render(sheet)` / `renderOne(n)` / `applyPositions()` / `refreshSelection()` | 描画 |
| `beginEdit(id,which)` / `commitEdit()` | 編集（which: 'text' | 'memo'） |
| `createAt(wx,wy,opts)` | 生成して即編集 |
| `onNodePointerDown(e,id)` / `startResize(e,id)` | ドラッグ/リサイズ |

## Edges（js_edges）— エッジ/枝
| メンバー | 説明 |
|---|---|
| `renderBranches(sheet)` / `clearBranches()` | ツリー親子の枝（branch-g） |
| `render(sheet)` | エッジ（edges-g）+ ラベル |
| `nodeRect(id)` / `anchor(r,side)` / `geom(e)` | 幾何計算（三次ベジェ） |
| `select(id)` / `deselect()` / `editLabel(id)` / `deleteSelected()` | 選択/ラベル/削除 |
| `startLink(e,fromId,side)` | ハンドルからの接続作成 |

## Tree（js_tree）— ツリーレイアウト
| メンバー | 説明 |
|---|---|
| `isTree()` | モード判定 |
| `roots()` / `childrenOf(id)` / `descendants(id)` | 階層走査（childrenOf は Y 昇順） |
| `computeVisibility()` | 折りたたみ配下に `_hidden` 付与 |
| `relayout()` | 右展開レイアウト（各ルートを格納位置に固定、子孫を相対配置） |
| `addChild(parentId)` / `addSibling(refId)` | 追加して即編集 |
| `toggleCollapse(id)` | 折りたたみ |
| `onDragEnd(id,ev)` | ドロップ先で再ペアレント |

## Sections（js_sections）
`render(sheet)` / `renderOne(sec)` / `contained(sec)` / `startDrag(e,id)` / `startResize(e,id)` / `editTitle(id)` / `startDraw(e)`

## Selection（js_selection）
| メンバー | 説明 |
|---|---|
| `nodes`(Set) / `sections`(Set) | 選択集合 |
| `hasNode/hasSection` / `nodeIds()/sectionIds()` | 参照 |
| `clear()` / `refresh()` | 解除 / UI 反映 |
| `selectNode(id)` / `toggleNode(id)` / `selectSection(id)` / `toggleSection(id)` / `selectAll()` | 選択（group 連動） |
| `prune()` | 存在しない ID を除去 |
| `deleteSelected()` | 選択削除（エッジ優先 → ノード/セクション） |
| `group()` / `ungroup()` | グループ化/解除 |
| `align(type)` | left/right/hcenter/top/bottom/vcenter/hdist/vdist |
| `startMarquee(e)` | 矩形選択 |

## Minimap（js_minimap）
`draw()` — 全体俯瞰 + ビューポート矩形。クリック/ドラッグで `Canvas.centerOn`。

## Search（js_search）
`open()` / `close()` / `run()`（全シート横断）/ `next()` / `prev()` / `jumpTo(i)` / `highlightCurrent()`

## Exporter（js_export）
`run(kind)`（'png'|'pdf'|'md'|'mermaid'）/ `capture()`（fit→html-to-image→復元）/ `png()` / `pdf()` / `markdown()` / `mermaid()` / `showText(title,text,ext)`

## Shortcuts（js_shortcuts）
`init()` / `editing()` / `onKey(e)` / `onPaste(e)` / `nudge(dx,dy)`

## Home（js_home）
`show()` / `render()` / `duplicate(id)` / `remove(id,name)` / `newModal()` / `create(name,mode)`

## App（js_app）— 統括
| メンバー | 説明 |
|---|---|
| `screen`('home'|'editor') / `tool` / `spaceDown` / `clipboard` / `clipboardText` | 状態 |
| `init()` | 全モジュール初期化 + UI 結線 + ホーム表示 |
| `enterEditor(p)` / `openProject(id)` / `showHome()` | 遷移 |
| `render()` | アクティブシート描画（[architecture 2.3](architecture.md) の順序） |
| `setTool(t)` / `updateToolbar()` / `updateAlignBar()` / `updateSheetTabs()` / `closeMenus()` | UI |
| `copy()` / `cut()` / `paste()` | クリップボード（id 再採番・内部エッジ/グループ複製）。ツリー型で単一ノード選択中の `paste()` は子ノード追加として扱う |
| `pasteTextAsChildren(parentId,text)` / `pasteNodesAsChildren(parentId)` | ツリー型の選択ノード配下ペースト |
| `toast(msg)` | 通知 |
| `onStageDown(e)` | ステージ背景の pointerdown 振り分け |

## サーバ（Code.gs）
| 関数 | 説明 |
|---|---|
| `doGet()` | index テンプレートを評価して返す |
| `include(filename)` | partial の中身を文字列で返す |
| `probeDurable()` | `{drive, sheet}`（各 backend の利用可否） |
| `driveSave/driveLoad/driveList/driveDelete` | Drive backend（フォルダ `MindCanvas`、`mc_<id>.json`） |
| `sheetSave(id,json,name,mode,updatedAt)` / `sheetLoad` / `sheetList` / `sheetDelete` | Sheet backend（`_mc_data` シート、1行=1プロジェクト） |
