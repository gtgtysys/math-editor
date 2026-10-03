# 数式機能の確認（2026-10-03）

`dist/engine.js` のパーサー・組版処理を確認した結果です。

## 優先して追加したいもの

- **場合分け・連立式**：`cases`、左波括弧と条件列。
- **複数行と整列**：`aligned`、`align`、等号位置揃え、改行。
- **二項係数**：`binom`。括弧付きで上下に数値を置く、横線なしの構造。
- **極限条件の位置**：`lim`自体は対応。ただし添字は通常の右下配置で、`limits`・`nolimits`には未対応。
- **装飾と説明**：`dot`、`ddot`、`underline`、`underbrace`、`overbrace`、`overset`、`underset`。
- **記号・関数の拡充**：`varepsilon`、`varphi`、`eta`、`zeta`等の不足コマンド、`sin`等以外の逆三角関数・双曲線関数・`det`など。Unicode直接入力やoperatornameで代替できるものもある。

## 既存機能の制限

- `frac`・`dfrac`・`tfrac`が同じ扱いで、表示スタイルを指定できない。
- 行列はmatrix・pmatrix・bmatrixのみ。vmatrix・Vmatrix・array、列の左右揃えには未対応。
- 行列の区切りが単純な文字列分割なので、入れ子行列の扱いに制限がある。
- 動的括弧は追加済みだが、middle・big等は未対応。括弧はフォントの輪郭ではなく独自の線で描く。
- mathbf・mathit・mathbb・mathcal等のTeX書体コマンドには未対応。UIでの個別フォント指定・全体太字は可能。

新機能はこの確認で一括追加していません。まず場合分け・複数行整列、その次に二項係数・極限条件配置を推奨します。
