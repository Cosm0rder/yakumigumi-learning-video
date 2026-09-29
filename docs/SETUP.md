# セットアップ

## 共通

Node.js 22以上（24推奨）を [公式配布ページ](https://nodejs.org/en/download) からインストールします。FFmpegとFFprobeは [FFmpeg公式案内](https://ffmpeg.org/download.html) を使い、どちらもPATHから呼べる状態にします。

```sh
node --version
ffmpeg -version
ffprobe -version
npm ci --ignore-scripts --no-audit --no-fund
npm run doctor
```

Canvasは固定バージョンとロックファイルを使用します。APIキーの設定は不要です。`npm ci` はインストールスクリプトを実行せず、対応OSのネイティブ描画パッケージを取得します。

## Windows

FFmpegの配布ZIPを展開して、`ffmpeg.exe` と `ffprobe.exe` のある `bin` フォルダーをPATHへ追加します。ターミナルを開き直して `npm run doctor` を実行します。PowerShellで `npm.ps1` の実行ポリシーに引っかかる場合は、ポリシーを緩めず `npm.cmd ci`、`npm.cmd run demo` のように実行できます。

## macOS・Linux

普段使っているパッケージマネージャー、またはFFmpeg公式の案内に従ってFFmpegをインストールしてください。日本語フォントは同梱しているため、システムの日本語フォント設定は不要です。macOS・Linuxはこの配布時点では未実機検証です。

## よくあるつまずき

| 症状 | 確認すること |
|---|---|
| `ffmpeg を実行できません` | PATHとターミナルの再起動 |
| `Cannot find module @napi-rs/canvas` | プロジェクト内で `npm ci --ignore-scripts --no-audit --no-fund` |
| `音声が未配置` | `npm run narration` で保存名を確認。映像だけなら `--draft` |
| 文字が長すぎて読みにくい | 1場面の項目を減らす・台詞を分ける |
| 音が小さい／割れる | 元音声を確認し、BGMを小さくする。完成品を試聴する |
| ブラウザーで動画が古い | 書き出し終了後に再読み込みする |
| ポート4173が使用中 | 前のプレビューをCtrl+Cで終了する |

長編はいきなり全編を書き出さず、`--seconds 10 --width 1280 --fps 24` などで確認します。既存の `output/` は同名ファイルを上書きするので、残したい出力は先に別名で保管してください。

