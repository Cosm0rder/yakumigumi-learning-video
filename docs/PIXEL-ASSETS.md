# 紹介動画用ピクセル素材

`assets/pixel/` に15キャラ各10モーションと、同じキャラクターの形態差分2種各10モーション、計170モーションの原画と生成コードを収録しています。Gitでは17原画PNG・170正規化ポーズ・必要なメタデータを保持し、シート・個別フレーム・GIF／APNGは初回に生成します。

**Gitから取得した直後は `npm ci --ignore-scripts --no-audit --no-fund` と `npm run pixel:build` を実行してください。** 生成後の [ギャラリー](pixel-gallery.html) と [ブラウザーサンプル](../examples/pixel-player.html) は、ファイルを直接開く `file://` で再生できます。新しいCanvas APIと素材テストも生成後に利用します。再生用サーバーやAPIキーは不要です。

15体の名前・ID・原作の確認根拠は [キャラクター一覧](PIXEL-ROSTER.md) と [`roster.json`](../assets/pixel/roster.json) を参照してください。`tube` はカラシ、`whale` はサンショウウオのサンショウの互換IDです。

## 10種類の動作

各動作に描き分けた表情・ポーズの原画を使い、待機ポーズとの切り替えとローカルのタイムライン処理で24フレームのループを作っています。

| ID | 動作 | 主な用途 |
| --- | --- | --- |
| `idle` | 待機 | 相手の話を聞く |
| `blink` | まばたき | 表情の間、短いリアクション |
| `walk` | 歩行／移動 | 登場・退場。画面内の横移動は呼び出し側で指定 |
| `cheer` | 喜ぶ | 正解、達成、歓迎 |
| `surprise` | 驚く | 発見、意外な結果 |
| `worry` | 困る | 失敗、疑問、注意点 |
| `think` | 考える | 検討、問いかけ |
| `talk` | 話す | 解説、会話 |
| `point` | 指さす／説明 | 図やカードを示す |
| `bow` | おじぎ | 導入、締め、感謝 |

形状は原画に従います。手足のないキャラクターは跳ね・傾き・伸び縮みで動きを表現し、目・口・手足は描き分けた原画をそのまま使います。追加の顔や人間の手足のオーバーレイは使用しません。各キャラの形状メモは `sources.json` の `anatomy` にあります。

シソ・大葉の名前と独立した発話は第57話で確認されていますが、紫色・緑色の葉の制作デザインは翻案ページに基づきます。独立した作者立ち絵の確認状況と、オクラ輪切りの個体に関する未確認点は [キャラクター一覧](PIXEL-ROSTER.md) に記録しています。

## 形態差分

形態差分はキャラクター数へ加算せず、`manifest.json` の `variants` で親キャラクターと対応づけています。どちらも10モーションを収録しています。

| variant ID | 親キャラID | 内容 |
| --- | --- | --- |
| `wasabi_tube` | `wasabi` | ワサビの緑色チューブ姿 |
| `okra_slice` | `okra` | オクラの星形輪切り姿。独立個体としての名前は未確認 |

## ファイル仕様

| 項目 | 仕様 |
| --- | --- |
| 個別PNG | 256×256px、RGBA透過 |
| タイミング | 12fps、24フレーム、2秒ループ |
| 基準点／pivot | 足元 `(128,240)` |
| スプライトシート | 6列×4行、1536×1024px。左上から右へ並び、次の行へ進む |
| GIF | ループプレビュー。透明度は二値 |
| APNG | フルカラー・部分透明に対応したループプレビュー |

以下のパスは `assets/pixel/` からの相対パスです。`<assetId>` にはキャラIDまたは形態差分ID、`<motionId>` には動作IDが入ります。

- `<assetId>/<motionId>.png`: 透過スプライトシート
- `<assetId>/frames/<motionId>/000.png`〜`023.png`: 個別フレーム
- `<assetId>/previews/<motionId>.gif`／`.apng`: 再生プレビュー
- `<assetId>/poses/drawn-v01/<motionId>.png`: 256pxへ正規化した描き分けキーポーズ
- `manifest.json`: 名前、親キャラ、ファイル対応、FPS、pivot、原画と切り出し処理のメタデータ
- `manifest.js`: 同じ情報をブラウザーで直接読むためのデータ
- `sources.json`: 再生成用のキーポーズ対応、形状メモ、原画出典、配置記録
- `masters/keyposes-seven/`／`masters/keyposes-lead/`: 変更せず保存した元キーポーズPNG
- `masters/pose-imports.json`: 正規化に使う切り出し範囲・動作順・出力先
- `masters/keypose-exact-bounds.json`: 元の成分境界の記録
- `roster.json`: 15体と互換IDの対応

新原画は ImageGen で制作したピクセル風のラスター画像です。多色や部分透明を含み、厳密な手打ちのネイティブドット格子で描かれた素材とは表記しません。元PNGを保持し、正規化・表示にはnearest-neighborを使います。

## Canvasへの合成

プロジェクト直下のコードのasync関数内で利用する例です。

```js
const { createPixelAnimation } = require('./src/pixel-animation.cjs');

const anim = await createPixelAnimation({
  character: 'shoga', action: 'talk', size: 512
});
anim.frame(0.75); // 秒。負時刻もループ内へ折り返す
ctx.imageSmoothingEnabled = false;
ctx.drawImage(anim.canvas, x, y);
```

形態差分は親キャラを `character`、姿を `variant` で指定します。

```js
const tube = await createPixelAnimation({
  character: 'wasabi', variant: 'wasabi_tube', action: 'point', size: 512
});
tube.frame(0.75);
ctx.drawImage(tube.canvas, x, y);
```

`character` は `manifest.json` の `characters` にあるIDまたは登録済みaliasを使います。未知のID・動作・親キャラと一致しない差分、不正サイズ、有限でない時刻はエラーになります。`size` は64〜2048の整数です。

## 再生成とMP4サンプル

```sh
npm run pixel:build              # 15キャラと2形態差分をすべて再生成
npm run pixel:build -- shoga     # 1キャラだけ再生成
npm run pixel:build -- wasabi_tube # 1形態差分だけ再生成
npm run pixel:demo -- shoga      # 1キャラの10動作を並べた4秒の無音MP4
npm run pixel:cast               # 15キャラを10動作順に見せる20秒の無音MP4
```

`pixel:demo` は `output/pixel-demo.mp4`、`pixel:cast` は `output/pixel-cast-demo.mp4` に出力します。`pixel:cast` は各動作を2秒ずつ再生し、15体を同じ画面に並べます。形態差分の確認にはギャラリーとブラウザーサンプルを使います。生成と再生はローカルのNode.js、Canvas、FFmpegで動き、音声は利用者が別途用意します。

通常のビルドは各動作の描き分けキーポーズを必須とします。`--allow-neutral` は中立原画だけで動きを試すためのオプションで、その試作出力は本番素材の170モーションには数えません。

公開前の確認コマンドは次のとおりです。CIでも初回生成後に同じ確認を行います。

```sh
npm run pixel:build
npm test
npm run audit
npm run smoke
```

## キーポーズの取り込みと正規化

取り込むPNGと切り出し範囲を実際に確認し、元PNGは `masters/` の新しいパスへ保存します。`masters/pose-imports.json` に各動作の範囲を登録し、`node scripts/pixel-keyposes.cjs <ID>` で256pxへ正規化してから `npm run pixel:build -- <ID>` を実行します。全件の正規化は `node scripts/pixel-keyposes.cjs` です。原画そのものの描画修正は原画制作側で行い、受領した元PNGを保持します。

正規化処理は次の順序です。

1. 確認した成分境界に余白を付けた範囲（`padded`）を元PNGから切り出す。
2. alphaが128未満の画素を透明化する。128以上の色と透明度は保持する。
3. `idle` の身体の高さを基準に、全ポーズがcanvasへ収まる共通倍率を求める。
4. 同じ倍率を全ポーズに使い、身体の底面を `(128,240)` へnearest-neighborで配置する。おじぎなどの元の高さ差を保つ。

すだちの `walk` と `point` は、原画の身体から離れた動きの線を保持するため、実効的な切り出し範囲だけを拡張しています。元PNGと `keypose-exact-bounds.json` の元の境界は保持し、`bodyTight` で身体の範囲を別に指定して足元の基準点を保ちます。`poseProvenance` には元画像、実効範囲、身体範囲、倍率、配置先、alpha閾値を記録しています。

既存の `assets/animations/` のしょうが8モーション、`docs/animations/` のGIF、従来の動画レンダラーは変更していません。利用条件は [ASSET-LICENSE.md](../ASSET-LICENSE.md)、[LICENSE](../LICENSE) と各フォントのOFLを参照してください。
