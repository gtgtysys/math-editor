# アイコン案

`index.html` を開くと5案と16・24・32・48pxの縮小表示を比較できます。
各案にInkscapeで編集できるSVG、透過PNG、Windows用ICOがあります。
ICOは16・24・32・48・64・128・256pxの画像を収録しています。

1. **01-classic** — 現行のƒを継承。深緑の角丸タイル。
2. **02-brackets** — 動的括弧と等号。式のまとまりを表現。
3. **03-slide** — スライド枠とx²。PowerPoint用途を表現。
4. **04-sigma** — 総和記号。数学アプリと分かりやすい案。
5. **05-pen** — 積分とペン先。書体・編集を表現。

5案は候補です。採用アイコンはユーザー作成の `made.svg` です。
`build/icon.svg` と `build/icon.ico` に `made.svg` を反映しました。全7サイズで四隅の透過を検証しています。
変更前のICOは `current-original.ico`、透過修正版は `current-transparent.ico` です。
変更前の256px画像は隅のアルファ値255（白・不透明）、変更後は0（透明）と確認しました。
インストール済みEXEへの反映にはアプリの再ビルド・更新が必要です。

生成方法：手書きSVGをSharpで透過PNG化し、各サイズをICOに格納。
採用アイコンの再生成：Sharpが使えるNode環境で `node scripts/build-icon.cjs` を実行。
画像生成AIは使わず、外部フォントにも依存しません。
