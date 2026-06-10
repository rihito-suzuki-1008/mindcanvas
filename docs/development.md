# 8. 開発・ビルド・デプロイ

関連: [architecture.md](architecture.md) ・ [README](README.md)

## 8.1 前提ツール
| ツール | 用途 |
|---|---|
| Node.js | `build_local.js` 実行 |
| clasp v3 | GAS への push / deploy（ログイン済み） |
| python3 | ローカルプレビュー用静的サーバ |
| モダンブラウザ | 動作確認 |

## 8.2 ソース構成（push 対象）
`src/` 配下のみ clasp が push する（[architecture 2.5](architecture.md)）。著作は機能別 `js_*.html` に分割し、`index.html` の `<?!= include('名前'); ?>` で単一 HTML にインライン展開される。

- 新しい JS モジュールを足す場合：`src/js_foo.html`（`<script>…</script>` でラップ）を作り、`index.html` の include 一覧に `<?!= include('js_foo'); ?>` を追加。

## 8.3 ローカル検証（GAS 不要）

GAS にデプロイせずブラウザで動作確認できる。

```bash
node build_local.js          # src/ を読み、include を展開して local_preview.html を生成
```
- `build_local.js` は `<?!= include('X') ?>` を `src/X.html` の中身に置換し、`google.script.run` を **localStorage 上の擬似 Drive / Sheets backend**（`probeDurable` 含む）にスタブ化する。
- URL に **`?backend=sheet`** を付けると probe が `drive:false` を返し、**Sheets 経路**を検証できる（既定は Drive 経路）。
- 生成物 `local_preview.html` と `build_local.js` は `src/` 外なので push されない。

### プレビューサーバ
リポジトリルートで静的サーバを起動して `http://localhost:8765/local_preview.html` を開く。

```bash
python3 -m http.server 8765
```

> 注意：コードを変更したら **再度 `node build_local.js`** を実行し、ブラウザを再読込（キャッシュ回避に `?v=<時刻>` を付与）する。

## 8.4 デプロイ

### 事前準備（初回のみ）
clasp push には **Apps Script API の有効化**が必要：
https://script.google.com/home/usersettings → 「Google Apps Script API」を ON（反映に数分）。

### コンテナバインド版の作成
スプレッドシートにバインドすると `spreadsheets.currentonly` でスプシ保存でき、Drive が使えない環境でも利用できる。
```bash
# 一時dirで bound プロジェクト（スプシ + script）を作成し scriptId を取得
cd /tmp && clasp create --type sheets --title "MindCanvas"
# 取得した scriptId を本体 .clasp.json の "scriptId" に設定（rootDir:src は維持）
```
- bound script には既定の `Code.gs` があり、ローカル `Code.js` と GAS 上で同名 "Code" になり衝突する。**サーバファイルは `src/Code.gs`** とする（本リポジトリ対応済み）。
- `.clasp.json` は各自の `scriptId` を含むため、リポジトリには含めない。

### push / deploy
```bash
clasp push -f
clasp deploy --description "MindCanvas v2 (sheet-bound)"
```
- Web アプリ URL：`https://script.google.com/macros/s/<デプロイID>/exec`
- 既存デプロイ更新で同一 URL 維持：`clasp deploy --deploymentId <id>`
- 初回アクセスでスコープ認可（`drive.file` + `spreadsheets.currentonly`）。

### Web アプリ設定（`src/appsscript.json`）
```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets.currentonly"
  ],
  "webapp": { "executeAs": "USER_DEPLOYING", "access": "MYSELF" }
}
```
- ※ Drive スコープ承認が拒否される環境では `drive.file` の行を削除 → probe が自動で Sheets 専用に倒す。

## 8.5 品質確認の方法
- **構文チェック**：各 `js_*.html` から `<script>` 行を除いて `node --check`。全結合しての重複 `const` 検出も有効。
- **手動 E2E**：[requirements](requirements.md) の FR を一通り（新規作成→ノード/編集→接続→ツリー Tab/Enter→整列/グループ→検索→Undo/Redo→エクスポート→リロード復元）。

## 8.6 既知の制約・留意点

| 区分 | 内容 |
|---|---|
| ダイアログ | シート名・接続ラベル・削除確認に `window.prompt/confirm` を使用。GAS サンドボックスでは動作するが、将来はカスタムモーダル化が望ましい。 |
| 永続性 | localStorage は origin 変動で揮発し得るため durable backend（Drive 優先・スプシ フォールバック）が前提（[storage-and-sync](storage-and-sync.md)）。 |
| Drive 制限環境 | `drive.file` 認可が拒否されると起動不可。`appsscript.json` の `drive.file` 行を削除すれば probe が自動で Sheets 専用に倒す。 |
| スプシ 1セル制限 | Sheet backend は 1プロジェクト=1セル(json)。~5万文字上限。巨大マップは将来分割が必要。 |
| 同時編集 | 非対応（last-write-wins）。複数タブ/端末で同一プロジェクトを同時編集すると上書きが起こり得る。 |
| エクスポート解像度 | PNG は「現在シートの fit 表示」を pixelRatio 2 で撮影。極端に広いボードは縮小され細部が潰れる場合がある。 |
| ツリー再ペアレント | 単一ノードのドラッグ時のみ判定（複数選択ドラッグは relayout のみ）。 |
| ノードドラッグ（ツリー） | 子ノードを空き場所にドロップすると relayout で元位置へ戻る（子位置は自動算出のため）。ルートは自由配置可。 |

## 8.7 ロードマップ（将来拡張の候補）
- ノードの色・タグ・アイコンによる分類
- 画像/添付の挿入
- テンプレート、アウトライン表示モード
- レイアウトエンジンの追加（左右バランス型マインドマップ / 組織図型）— `Tree.relayout` を差し替え可能に設計済み
- カスタムモーダルによる `prompt/confirm` 置換
- AI による発散・分類・要約
