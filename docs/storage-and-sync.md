# 6. 保存と同期（Drive / スプレッドシート 自動フォールバック）

関連: [data-model.md](data-model.md) ・ [modules-api.md](modules-api.md)

## 6.1 ストレージ構成（3層）

| 層 | 役割 | 特性 |
|---|---|---|
| **localStorage** | 即時保存（常時） | 同期的・高速。GAS サンドボックス iframe の origin 変動で揮発し得る |
| **durable: Google Drive** | 自動バックアップ（**優先**） | `drive.file`。フォルダ `MindCanvas/mc_<id>.json` |
| **durable: スプレッドシート** | 自動バックアップ（**フォールバック**） | `spreadsheets.currentonly`。コンテナバインド先の隠しシート `_mc_data` |

> 起動時に `probeDurable()` で Drive / Sheets の可否を判定し、**Drive 優先・不可なら Sheets** を `Store.backend` に確定。両方不可なら `local`（localStorage のみ）。**社内で Drive が封印されていれば自動で Sheets に倒れる。**

## 6.2 バックエンド選択（起動時）

```
App.init → Store.initBackend(cb)
  → google.script.run.probeDurable()  // → {drive:bool, sheet:bool}
  → backend = drive 可? 'drive' : sheet 可? 'sheet' : 'local'
  → setStatus → cb()（ホーム表示 + マージ）
```
- `Store.backend`：`'drive'` | `'sheet'` | `'local'`。
- GAS 外（ローカル検証）は probe せず `'local'`（スタブでは probe を擬似）。

## 6.3 localStorage キー（不変）

| キー | 内容 |
|---|---|
| `mc:index` | プロジェクト meta 配列 `[{id,name,mode,createdAt,updatedAt}]` |
| `mc:project:<id>` | プロジェクト本体の JSON |

## 6.4 保存パイプライン（書き込み）

```
ミューテーション → State.touch()
  → Store.scheduleSave()              // setStatus('saving'), 350ms デバウンス
      → Store.saveLocalNow(project)   // localStorage
      → Store.scheduleDurableSync()   // 2200ms デバウンス（backend≠'local' のとき）
          → Store.durableSyncNow() → Store._durableSave(project)
                backend==='drive' : driveSave(id, json)
                backend==='sheet' : sheetSave(id, json, name, mode, updatedAt)
          → 成功 setStatus('synced') / 失敗 setStatus('error')
```
- ビューポート（pan/zoom）は履歴を汚さないよう `Canvas._persist`（600ms）から直接 `scheduleSave()`。

### デバウンス値
| 処理 | 遅延 |
|---|---|
| local 保存 | 350ms |
| durable 同期 | 2200ms |
| ビューポート保存 | 600ms |

## 6.5 読み込み・競合解決

- **`Store.loadProject(id, cb)`**：local 取得 → `_durableLoad`（backend に応じ `driveLoad`/`sheetLoad`）→ `updatedAt` 比較で新しい方を採用（remote 採用時は local にも保存）。
- **`Store.refreshFromDrive(cb)`**（名称は踏襲・backend 対応）：`_durableList`（`driveList`/`sheetList`）→ local に無い/古い id を `_durableLoad` → `saveLocalNow`。
- 競合は **last-write-wins**（`updatedAt`）。

## 6.6 サーバ API（Code.gs）

| backend | 関数 |
|---|---|
| probe | `probeDurable()` → `{drive, sheet}`（`DriveApp.getRootFolder()` と `SpreadsheetApp.getActiveSpreadsheet()` を try/catch） |
| Drive | `driveSave(id,json)` / `driveLoad(id)` / `driveList()` / `driveDelete(id)`（フォルダ `MindCanvas`） |
| Sheet | `sheetSave(id,json,name,mode,updatedAt)` / `sheetLoad(id)` / `sheetList()` / `sheetDelete(id)`（`_mc_data`） |

クライアントは `Store._durableSave/_durableLoad/_durableList/_durableDelete` が `backend` を見て上記を呼び分ける。

## 6.7 権限・スコープ

| 設定 | 値 |
|---|---|
| `oauthScopes` | `drive.file` ＋ `spreadsheets.currentonly` |
| `webapp.executeAs` | `USER_DEPLOYING` |
| `webapp.access` | `MYSELF` |

- **Drive スコープ承認が拒否される環境**では、`appsscript.json` から `drive.file` の1行を削除すれば良い。probe が `drive:false` を返し、自動で Sheets 専用になる。
- `spreadsheets.currentonly` は「コンテナバインド先のスプレッドシートのみ」を読み書きする最小スコープ。

## 6.8 保管構造

```
■ Drive backend
マイドライブ/MindCanvas/
   ├ mc_pj_xxxx.json   ← 1プロジェクト = 1ファイル
   └ …

■ Sheet backend（コンテナバインド先スプレッドシート）
隠しシート「_mc_data」
   | id | name | mode | updatedAt | json |   ← ヘッダ
   | pj_xxxx | 企画 | tree | 1717... | {...} |  ← 1行 = 1プロジェクト
```
- 1セル上限 ~5万文字。巨大マップはこの上限に注意（将来は複数セル分割）。
