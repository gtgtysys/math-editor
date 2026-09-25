# Ceol Formula Studio

PowerPoint向けのWindowsデスクトップ数式エディタです。ブラウザ版の公開は終了し、デスクトップ版を配布しています。

[Windows版 v1.1.0をダウンロード](https://github.com/gtgtysys/math-editor/releases/download/v1.1.0/Ceol-Formula-Studio-1.1.0-portable.exe)

Windows 10/11対応のポータブル版です。Node.jsやURL入力は不要です。フォントとAPIキーは同梱していません。

## 主な機能

- 分数、平方根、上下付き、総和、積分、行列などの数式
- Ceol ItalicとEuclid Symbol Regularを初期設定
- PC内フォントと文字ごとのフォント・位置・色指定
- 透過背景、PowerPoint標準色、SVG／EMF／PNG
- PowerPointから数式・文字位置・色・フォント設定を復元
- Gemini／OpenAIによる自然言語・画像からの数式変換

## 使い方

1. EXEをダウンロードして任意のフォルダへ置きます。
2. ダブルクリックして起動します。
3. 「画像をコピー」でPowerPointへ貼り付けます。
4. PowerPoint上の画像をコピーし、「PPTから貼り付け」で再編集します。

## 全体設定の初期値

文字はCeol Italic、数式記号はEuclid Symbol Regular、サイズは28 pt、文字色は黒、太字はオフ、背景は透過、余白は12 px、出力サイズは1/3、コピー形式はベクター、PNG解像度は3×です。文字を選択して変更した設定は、その文字だけに適用されます。

## API設定

EXEと同じ場所に次の構成で置きます。

```text
Ceol-Formula-Studio-1.1.0-portable.exe
config/
  api-settings.json
```

`api-settings.json`の例:

```json
{
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "key": "APIキー"
}
```

APIキーを含む実ファイルはGitHubへ公開しないでください。

## ソースコード

[デスクトップ版ソースZIP](https://github.com/gtgtysys/math-editor/releases/download/v1.1.0/Ceol-Formula-Studio-1.1.0-source.zip)

フォントファイルは配布物とソースに含めていません。利用するPCへ必要なフォントを導入してください。
